from __future__ import annotations

import hashlib
import math
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

from app.models import HouseItem, HouseSearchRequest

EARTH_RADIUS_KM = 6_371.0088
REQUIRED_TABLES = frozenset({"listings", "listings_rtree"})


class HousingRepository:
    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def _connect(self) -> sqlite3.Connection:
        if not self._database_path.is_file():
            raise FileNotFoundError("housing database is unavailable")
        connection = sqlite3.connect(
            f"{self._database_path.as_uri()}?mode=ro",
            uri=True,
            timeout=2,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        return connection

    def check_ready(self) -> None:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
            ).fetchall()
            available = {str(row["name"]) for row in rows}
            if not REQUIRED_TABLES.issubset(available):
                raise RuntimeError("housing database schema is incomplete")
            connection.execute("SELECT 1 FROM listings LIMIT 1").fetchone()
            connection.execute("SELECT 1 FROM listings_rtree LIMIT 1").fetchone()

    def search(self, request: HouseSearchRequest) -> list[HouseItem]:
        min_lng, max_lng, min_lat, max_lat = _bounding_box(
            request.center.lat,
            request.center.lng,
            request.radius_m,
        )
        sql = """
            SELECT
                l.id, l.external_id, l.source, l.title, l.url, l.price,
                l.rent_type, l.layout, l.area, l.floor, l.orientation,
                l.community, l.address, l.district, l.lat, l.lng
            FROM listings_rtree AS r
            JOIN listings AS l ON l.id = r.id
            WHERE r.minLng >= ? AND r.maxLng <= ?
              AND r.minLat >= ? AND r.maxLat <= ?
              AND l.city = ?
              AND l.lat IS NOT NULL AND l.lng IS NOT NULL
              AND l.price IS NOT NULL AND l.price >= 0
        """
        parameters: list[object] = [
            min_lng,
            max_lng,
            min_lat,
            max_lat,
            request.city,
        ]
        filters = request.filters
        clauses = [
            (filters.price_min, "l.price >= ?"),
            (filters.price_max, "l.price <= ?"),
            (filters.rent_type, "l.rent_type = ?"),
            (filters.area_min, "l.area >= ?"),
            (filters.area_max, "l.area <= ?"),
            (filters.district, "l.district = ?"),
        ]
        for value, clause in clauses:
            if value is not None:
                sql += f" AND {clause}"
                parameters.append(value)
        if filters.layout is not None:
            sql += " AND l.layout LIKE ? ESCAPE '\\'"
            escaped_layout = (
                filters.layout.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            parameters.append(f"{escaped_layout}%")

        with self._connect() as connection:
            rows = connection.execute(sql, parameters).fetchall()

        candidates: list[tuple[HouseItem, float, float]] = []
        for row in rows:
            distance_m = _haversine(
                request.center.lat,
                request.center.lng,
                float(row["lat"]),
                float(row["lng"]),
            )
            if distance_m > request.radius_m:
                continue
            monthly_rent = float(row["price"])
            area_sqm = max(0.0, float(row["area"] or 0))
            item = HouseItem(
                listing_id=_public_listing_id(
                    row["source"], row["external_id"], row["id"]
                ),
                title=_text(row["title"], "历史房源记录"),
                community=_text(row["community"], "小区信息缺失"),
                address=_text(row["address"], "地址信息缺失"),
                district=_text(row["district"], "区域信息缺失"),
                distance_m=round(distance_m, 1),
                monthly_rent=monthly_rent,
                rent_type=_text(row["rent_type"], "租赁方式缺失"),
                layout=_text(row["layout"], "户型信息缺失"),
                area_sqm=area_sqm,
                orientation=_text(row["orientation"], "朝向信息缺失"),
                floor=_text(row["floor"], "楼层信息缺失"),
                source_url=_safe_url(row["url"]),
                longitude=float(row["lng"]),
                latitude=float(row["lat"]),
            )
            candidates.append((item, monthly_rent, area_sqm))

        if request.sort == "price_asc":
            candidates.sort(key=lambda value: (value[1], value[0].listing_id))
        elif request.sort == "price_desc":
            candidates.sort(key=lambda value: (-value[1], value[0].listing_id))
        elif request.sort == "area_desc":
            candidates.sort(key=lambda value: (-value[2], value[0].listing_id))
        else:
            candidates.sort(
                key=lambda value: (value[0].distance_m, value[0].listing_id)
            )
        return [candidate[0] for candidate in candidates[: request.limit]]


def _text(value: object, fallback: str) -> str:
    text = str(value or "").strip()
    return text[:500] if text else fallback


def _safe_url(value: object) -> str | None:
    text = str(value or "").strip()
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return text[:2_048]


def _public_listing_id(
    source: object, external_id: object, internal_id: object
) -> str:
    stable_id = str(external_id or "").strip() or f"internal:{internal_id}"
    digest = hashlib.sha256(f"{source}:{stable_id}".encode()).hexdigest()
    return f"house_{digest[:20]}"


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * 1_000 * math.asin(math.sqrt(value))


def _bounding_box(
    lat: float, lng: float, radius_m: int
) -> tuple[float, float, float, float]:
    delta_lat = (radius_m / 1_000) / EARTH_RADIUS_KM
    cosine = max(abs(math.cos(math.radians(lat))), 1e-12)
    delta_lng = delta_lat / cosine
    return (
        lng - math.degrees(delta_lng),
        lng + math.degrees(delta_lng),
        lat - math.degrees(delta_lat),
        lat + math.degrees(delta_lat),
    )
