from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest


@pytest.fixture()
def housing_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "housing.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(
        """
        CREATE TABLE listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            external_id TEXT,
            source TEXT,
            title TEXT,
            url TEXT,
            price REAL,
            price_unit TEXT,
            rent_type TEXT,
            layout TEXT,
            house_type TEXT,
            area REAL,
            floor TEXT,
            orientation TEXT,
            community TEXT,
            address TEXT,
            city TEXT,
            district TEXT,
            lat REAL,
            lng REAL,
            tags TEXT,
            facilities TEXT,
            images TEXT,
            maintain TEXT,
            heating TEXT,
            elevator TEXT,
            payment TEXT,
            deposit REAL,
            service_fee REAL,
            agency_fee REAL,
            water TEXT,
            electricity TEXT,
            gas TEXT,
            publish_time TEXT,
            collect_time TEXT,
            raw TEXT
        );
        CREATE VIRTUAL TABLE listings_rtree USING rtree(
            id, minLng, maxLng, minLat, maxLat
        );
        """
    )
    rows = [
        (
            "HZ-001",
            "ke",
            "武林广场旁整租两居",
            "https://example.invalid/HZ-001",
            3800,
            "month",
            "整租",
            "2室1厅",
            65,
            "中楼层",
            "南",
            "环北新村",
            "拱墅区武林路 1 号",
            "杭州",
            "拱墅区",
            30.2742,
            120.1552,
            '{"private_note":"must-not-leak"}',
        ),
        (
            "HZ-002",
            "ke",
            "远处合租单间",
            "https://example.invalid/HZ-002",
            1800,
            "month",
            "合租",
            "1室0厅",
            20,
            "高楼层",
            "东",
            "远郊小区",
            "余杭区测试路 2 号",
            "杭州",
            "余杭区",
            30.3742,
            120.2552,
            '{"private_note":"must-not-leak"}',
        ),
    ]
    for row in rows:
        cursor = connection.execute(
            """
            INSERT INTO listings(
                external_id, source, title, url, price, price_unit,
                rent_type, layout, area, floor, orientation, community,
                address, city, district, lat, lng, raw
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            row,
        )
        listing_id = cursor.lastrowid
        connection.execute(
            "INSERT INTO listings_rtree VALUES (?, ?, ?, ?, ?)",
            (listing_id, row[16], row[16], row[15], row[15]),
        )
    connection.commit()
    connection.close()
    return db_path
