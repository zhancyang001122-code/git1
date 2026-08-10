from __future__ import annotations

import hashlib
import hmac
import threading
import time
from collections import defaultdict

from fastapi import Request

from app.config import Settings
from app.errors import ApiError


class FixedWindowRateLimiter:
    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._entries: dict[tuple[str, int], int] = defaultdict(int)
        self._lock = threading.Lock()

    def check(self, identity: str) -> None:
        window = int(time.monotonic() // 60)
        key = (identity, window)
        with self._lock:
            self._entries[key] += 1
            count = self._entries[key]
            if len(self._entries) > 2_000:
                self._entries = defaultdict(
                    int,
                    {
                        entry_key: value
                        for entry_key, value in self._entries.items()
                        if entry_key[1] >= window - 1
                    },
                )
        if count > self._limit:
            raise ApiError(
                status_code=429,
                code="RATE_LIMITED",
                message="请求过于频繁，请稍后重试",
                retryable=True,
            )


def authorize(
    request: Request,
    settings: Settings,
    limiter: FixedWindowRateLimiter,
) -> None:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or not hmac.compare_digest(
        token, settings.api_key
    ):
        raise ApiError(
            status_code=401,
            code="UNAUTHORIZED",
            message="缺少或无效的访问凭据",
        )
    identity = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
    limiter.check(identity)
