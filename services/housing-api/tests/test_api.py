from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

API_KEY = "test-key-that-is-at-least-32-characters"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def client_for(db_path: Path, *, rate_limit: int = 60) -> TestClient:
    settings = Settings(
        database_path=db_path,
        api_key=API_KEY,
        environment="test",
        rate_limit_per_minute=rate_limit,
    )
    return TestClient(create_app(settings))


def valid_payload() -> dict[str, object]:
    return {
        "city": "杭州",
        "center": {
            "lat": 30.2741,
            "lng": 120.1551,
            "coordinate_system": "WGS84",
            "label": "武林广场",
        },
        "radius_m": 2_000,
        "filters": {
            "price_min": None,
            "price_max": 4_000,
            "rent_type": "整租",
            "layout": "2室1厅",
            "area_min": 50,
            "area_max": None,
            "district": "拱墅区",
        },
        "sort": "distance",
        "limit": 5,
    }


def test_health_reports_database_readiness(housing_db: Path) -> None:
    with client_for(housing_db) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "housing-api",
        "database": "ready",
        "dataset_period": "2024-11",
    }


def test_search_requires_bearer_authentication(housing_db: Path) -> None:
    with client_for(housing_db) as client:
        response = client.post("/v1/houses/search", json=valid_payload())

    assert response.status_code == 401
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "request_id" in body["meta"]


def test_search_returns_safe_historical_contract_without_mutating_database(
    housing_db: Path,
) -> None:
    before = digest(housing_db)
    with client_for(housing_db) as client:
        response = client.post(
            "/v1/houses/search",
            json=valid_payload(),
            headers={"Authorization": f"Bearer {API_KEY}"},
        )
    after = digest(housing_db)

    assert response.status_code == 200
    assert before == after
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["returned_count"] == 1
    item = body["data"]["items"][0]
    assert item["title"] == "武林广场旁整租两居"
    assert item["monthly_rent"] == 3800
    assert item["distance_m"] < 100
    assert item["listing_id"].startswith("house_")
    assert "raw" not in item
    assert "external_id" not in item
    assert "contact" not in item
    assert body["source"]["dataset_period"] == "2024-11"
    assert body["source"]["is_historical"] is True
    assert body["source"]["is_realtime"] is False
    assert body["meta"]["request_id"]
    assert body["meta"]["duration_ms"] >= 0


def test_invalid_city_uses_stable_error_contract(housing_db: Path) -> None:
    payload = valid_payload()
    payload["city"] = "绍兴"
    with client_for(housing_db) as client:
        response = client.post(
            "/v1/houses/search",
            json=payload,
            headers={"Authorization": f"Bearer {API_KEY}"},
        )

    assert response.status_code == 400
    body = response.json()
    assert body["ok"] is False
    assert body["error"] == {
        "code": "UNSUPPORTED_CITY",
        "message": "当前历史房源数据仅覆盖杭州",
        "retryable": False,
    }


def test_layout_filter_accepts_a_room_count_prefix(housing_db: Path) -> None:
    payload = valid_payload()
    payload["filters"]["layout"] = "2室"  # type: ignore[index]
    with client_for(housing_db) as client:
        response = client.post(
            "/v1/houses/search",
            json=payload,
            headers={"Authorization": f"Bearer {API_KEY}"},
        )

    assert response.status_code == 200
    assert response.json()["data"]["returned_count"] == 1


def test_validation_errors_do_not_expose_framework_details(housing_db: Path) -> None:
    payload = valid_payload()
    payload["radius_m"] = 99_999
    with client_for(housing_db) as client:
        response = client.post(
            "/v1/houses/search",
            json=payload,
            headers={"Authorization": f"Bearer {API_KEY}"},
        )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "INVALID_ARGUMENT"
    assert body["error"]["retryable"] is False
    assert "traceback" not in response.text.lower()
    assert str(housing_db) not in response.text


def test_rate_limit_uses_stable_error_contract(housing_db: Path) -> None:
    with client_for(housing_db, rate_limit=1) as client:
        first = client.post(
            "/v1/houses/search",
            json=valid_payload(),
            headers={"Authorization": f"Bearer {API_KEY}"},
        )
        second = client.post(
            "/v1/houses/search",
            json=valid_payload(),
            headers={"Authorization": f"Bearer {API_KEY}"},
        )

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["error"] == {
        "code": "RATE_LIMITED",
        "message": "请求过于频繁，请稍后重试",
        "retryable": True,
    }
