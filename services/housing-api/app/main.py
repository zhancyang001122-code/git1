from __future__ import annotations

import json
import logging
import sqlite3
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.config import Settings
from app.errors import ApiError
from app.models import (
    HouseSearchData,
    HouseSearchRequest,
    HouseSearchResponse,
    ResponseMeta,
    SourceMetadata,
)
from app.repository import HousingRepository
from app.security import FixedWindowRateLimiter, authorize

LOGGER = logging.getLogger("housing_api")
SOURCE = SourceMetadata(
    label="2024年11月杭州租房历史快照",
    disclaimer="仅供历史房源参考，不代表当前仍可出租或当前价格",
)


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", uuid.uuid4().hex))


def _error_response(request: Request, error: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={
            "ok": False,
            "error": {
                "code": error.code,
                "message": error.message,
                "retryable": error.retryable,
            },
            "meta": {"request_id": _request_id(request)},
        },
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or Settings.from_environment()
    repository = HousingRepository(configuration.database_path)
    limiter = FixedWindowRateLimiter(configuration.rate_limit_per_minute)
    app = FastAPI(
        title="Xiaozhi Housing History API",
        version="1.0.0",
        docs_url="/docs" if configuration.environment != "production" else None,
        redoc_url=None,
    )

    @app.middleware("http")
    async def request_boundary(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request.state.request_id = uuid.uuid4().hex
        content_length = request.headers.get("content-length")
        try:
            request_bytes = int(content_length) if content_length else 0
        except ValueError:
            request_bytes = configuration.max_request_bytes + 1
        if request_bytes < 0 or request_bytes > configuration.max_request_bytes:
            return _error_response(
                request,
                ApiError(
                    status_code=413,
                    code="PAYLOAD_TOO_LARGE",
                    message="请求体超过允许大小",
                ),
            )
        response = await call_next(request)
        response.headers["X-Request-ID"] = _request_id(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, error: ApiError) -> JSONResponse:
        return _error_response(request, error)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            request,
            ApiError(
                status_code=400,
                code="INVALID_ARGUMENT",
                message="请求参数无效，请检查字段和取值范围",
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(
        request: Request, error: Exception
    ) -> JSONResponse:
        LOGGER.error(
            json.dumps(
                {
                    "event": "housing_api_unhandled_error",
                    "request_id": _request_id(request),
                    "error_type": type(error).__name__,
                },
                ensure_ascii=False,
            )
        )
        return _error_response(
            request,
            ApiError(
                status_code=500,
                code="INTERNAL_ERROR",
                message="服务暂时不可用",
                retryable=True,
            ),
        )

    @app.get("/health", response_model=None)
    def health(request: Request) -> JSONResponse:
        try:
            repository.check_ready()
        except (FileNotFoundError, RuntimeError, sqlite3.Error):
            return _error_response(
                request,
                ApiError(
                    status_code=503,
                    code="DATA_UNAVAILABLE",
                    message="历史房源数据库暂不可用",
                    retryable=True,
                ),
            )
        return JSONResponse(
            content={
                "ok": True,
                "service": "housing-api",
                "database": "ready",
                "dataset_period": "2024-11",
            }
        )

    @app.post(
        "/v1/houses/search",
        response_model=HouseSearchResponse,
        response_model_exclude_none=True,
    )
    def search_houses(
        request: Request, payload: HouseSearchRequest
    ) -> HouseSearchResponse:
        authorize(request, configuration, limiter)
        if payload.city != "杭州":
            raise ApiError(
                status_code=400,
                code="UNSUPPORTED_CITY",
                message="当前历史房源数据仅覆盖杭州",
            )
        started_at = time.perf_counter()
        try:
            items = repository.search(payload)
        except (FileNotFoundError, RuntimeError, sqlite3.Error) as error:
            raise ApiError(
                status_code=503,
                code="DATA_UNAVAILABLE",
                message="历史房源数据库暂不可用",
                retryable=True,
            ) from error
        duration_ms = max(0, round((time.perf_counter() - started_at) * 1_000))
        LOGGER.info(
            json.dumps(
                {
                    "event": "housing_search_completed",
                    "request_id": _request_id(request),
                    "city": payload.city,
                    "district": payload.filters.district,
                    "result_count": len(items),
                    "duration_ms": duration_ms,
                },
                ensure_ascii=False,
            )
        )
        return HouseSearchResponse(
            data=HouseSearchData(returned_count=len(items), items=items),
            source=SOURCE,
            meta=ResponseMeta(
                request_id=_request_id(request),
                duration_ms=duration_ms,
            ),
        )

    return app
