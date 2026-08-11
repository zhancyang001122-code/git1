from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from housing_import import (
    MAX_DATABASE_BYTES,
    DatasetDigest,
    HttpResponse,
    ImportStatus,
    RowRejected,
    SupabaseHousingStore,
    SupabaseRequestError,
    activate_dataset,
    apply_dataset,
    dry_run,
    normalize_row,
    parse_bedrooms,
    verify_dataset,
)


def source_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "external_id": "hz-001",
        "source": "source-a",
        "title": "整租·武林小区一室一厅",
        "url": "https://example.com/house/1",
        "price": 3200.0,
        "rent_type": "整租",
        "layout": "1室1厅1卫",
        "area": 42.5,
        "floor": "中楼层",
        "orientation": "南",
        "community": "武林小区",
        "address": None,
        "city": "杭州",
        "district": None,
        "lat": 30.2741,
        "lng": 120.1551,
        "raw": '{"phone":"must-not-leave-source"}',
        "images": "[]",
    }
    row.update(overrides)
    return row


def json_bytes(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":")).encode()


class FakeStore:
    def __init__(self, *, database_bytes: int = 100_000_000) -> None:
        self.database_bytes = database_bytes
        self.releases: dict[str, dict[str, object]] = {}
        self.rows: dict[str, dict[str, dict[str, object]]] = {}
        self.activation_calls: list[str] = []

    def prepare_release(self, release: dict[str, object]) -> dict[str, object]:
        release_id = str(release["id"])
        current = self.releases.get(release_id)
        if current is not None:
            if current["content_checksum"] != release["content_checksum"]:
                raise AssertionError("test store checksum conflict")
            return current
        self.releases[release_id] = dict(release)
        self.rows[release_id] = {}
        return self.releases[release_id]

    def upsert_rows(self, release_id: str, rows: list[dict[str, object]]) -> None:
        for row in rows:
            self.rows[release_id][str(row["id"])] = dict(row)

    def update_imported_count(self, release_id: str, count: int) -> None:
        self.releases[release_id]["imported_count"] = count

    def iter_rows(self, release_id: str):
        yield from self.rows[release_id].values()

    def get_import_status(self, release_id: str) -> ImportStatus:
        release = self.releases[release_id]
        return ImportStatus(
            release_id=release_id,
            status=str(release["status"]),
            expected_count=int(release["expected_count"]),
            imported_count=int(release.get("imported_count", 0)),
            actual_count=len(self.rows[release_id]),
            content_checksum=str(release["content_checksum"]),
            table_bytes=10_000_000,
            index_bytes=2_000_000,
            database_bytes=self.database_bytes,
        )

    def activate(self, release_id: str) -> None:
        self.activation_calls.append(release_id)
        self.releases[release_id]["status"] = "active"


def create_source_database(path: Path) -> None:
    connection = sqlite3.connect(path)
    connection.execute(
        """
        create table listings (
          external_id text,
          source text,
          title text,
          url text,
          price real,
          rent_type text,
          layout text,
          area real,
          floor text,
          orientation text,
          community text,
          address text,
          city text,
          district text,
          lat real,
          lng real,
          raw text,
          images text
        )
        """
    )
    keys = list(source_row().keys())
    placeholders = ",".join("?" for _ in keys)
    for row in [
        source_row(),
        source_row(
            external_id="hz-002",
            title=None,
            url="https://example.com/house/2",
            price=2800.0,
            layout="2室1厅1卫",
            area=None,
            lat=30.275,
            lng=120.156,
        ),
        source_row(external_id="bad-price", price=0),
    ]:
        connection.execute(
            f"insert into listings ({','.join(keys)}) values ({placeholders})",
            [row[key] for key in keys],
        )
    connection.commit()
    connection.close()


class NormalizationTests(unittest.TestCase):
    def test_generates_stable_public_identity_and_source_hash(self) -> None:
        first = normalize_row(source_row(), release_id="release-a")
        second = normalize_row(source_row(), release_id="release-a")

        self.assertEqual(first["id"], second["id"])
        self.assertRegex(str(first["id"]), r"^[0-9a-f-]{36}$")
        self.assertRegex(str(first["source_key_hash"]), r"^[0-9a-f]{64}$")
        self.assertNotIn("hz-001", str(first["source_key_hash"]))

    def test_only_emits_the_database_allowlist(self) -> None:
        normalized = normalize_row(source_row(), release_id="release-a")

        self.assertEqual(
            set(normalized),
            {
                "id",
                "release_id",
                "dataset_period",
                "source_key_hash",
                "title",
                "city",
                "district",
                "address",
                "community",
                "price_monthly",
                "rent_type",
                "layout",
                "bedrooms",
                "area_sqm",
                "floor",
                "orientation",
                "longitude",
                "latitude",
                "source_url",
            },
        )
        self.assertNotIn("raw", normalized)
        self.assertNotIn("images", normalized)

    def test_preserves_missing_values_and_rejects_unsafe_url(self) -> None:
        normalized = normalize_row(
            source_row(title="  ", area=None, url="javascript:alert(1)"),
            release_id="release-a",
        )

        self.assertIsNone(normalized["title"])
        self.assertIsNone(normalized["area_sqm"])
        self.assertIsNone(normalized["source_url"])

    def test_rejects_invalid_required_facts(self) -> None:
        cases = [
            (source_row(price=0), "invalid_price"),
            (source_row(price=3200.5), "non_integral_price"),
            (source_row(lat=91), "invalid_coordinates"),
            (source_row(source=""), "missing_source_key"),
        ]
        for row, reason in cases:
            with (
                self.subTest(reason=reason),
                self.assertRaisesRegex(RowRejected, reason),
            ):
                normalize_row(row, release_id="release-a")

    def test_parses_only_explicit_bedroom_prefixes(self) -> None:
        self.assertEqual(parse_bedrooms("1室1厅1卫"), 1)
        self.assertEqual(parse_bedrooms("12室3厅"), 12)
        self.assertIsNone(parse_bedrooms("开间"))
        self.assertIsNone(parse_bedrooms(None))


class DigestTests(unittest.TestCase):
    def test_digest_is_order_independent_but_count_sensitive(self) -> None:
        rows = [
            normalize_row(source_row(), release_id="release-a"),
            normalize_row(
                source_row(external_id="hz-002", url=None),
                release_id="release-a",
            ),
        ]
        forward = DatasetDigest()
        reverse = DatasetDigest()
        duplicate = DatasetDigest()
        for row in rows:
            forward.update(row)
        for row in reversed(rows):
            reverse.update(row)
        for row in [*rows, rows[0]]:
            duplicate.update(row)

        self.assertEqual(forward.hexdigest(), reverse.hexdigest())
        self.assertNotEqual(forward.hexdigest(), duplicate.hexdigest())


class SupabaseStoreTests(unittest.TestCase):
    def test_requires_a_new_server_only_secret_key(self) -> None:
        with self.assertRaisesRegex(ValueError, "sb_secret_"):
            SupabaseHousingStore(
                base_url="https://project.supabase.co",
                secret_key="legacy-service-role-key",
            )

    def test_retries_transient_failure_once_and_redacts_secret(self) -> None:
        secret = "sb_secret_test-only-value"
        calls: list[tuple[str, str, dict[str, str]]] = []
        sleeps: list[float] = []

        def transport(method, url, headers, body, timeout):
            del body, timeout
            calls.append((method, url, dict(headers)))
            return HttpResponse(
                status=503,
                headers={},
                body=f'{{"message":"failed {secret}"}}'.encode(),
            )

        store = SupabaseHousingStore(
            base_url="https://project.supabase.co",
            secret_key=secret,
            transport=transport,
            sleeper=sleeps.append,
        )

        with self.assertRaises(SupabaseRequestError) as raised:
            store.get_import_status("release-a")

        self.assertEqual(len(calls), 2)
        self.assertEqual(sleeps, [0.25])
        self.assertNotIn(secret, str(raised.exception))
        self.assertIn("[redacted]", str(raised.exception))
        self.assertEqual(calls[0][2]["apikey"], secret)
        self.assertEqual(calls[0][2]["authorization"], f"Bearer {secret}")

    def test_maps_import_status_without_exposing_transport_shape(self) -> None:
        def transport(method, url, headers, body, timeout):
            del method, url, headers, body, timeout
            return HttpResponse(
                status=200,
                headers={"content-type": "application/json"},
                body=json_bytes(
                    [
                        {
                            "status": "importing",
                            "expected_count": 2,
                            "imported_count": 2,
                            "actual_count": 2,
                            "content_checksum": "a" * 64,
                            "table_bytes": 100,
                            "index_bytes": 20,
                            "database_bytes": 1_000,
                        }
                    ]
                ),
            )

        store = SupabaseHousingStore(
            base_url="https://project.supabase.co",
            secret_key="sb_secret_test-only-value",
            transport=transport,
        )

        status = store.get_import_status("release-a")

        self.assertEqual(status.release_id, "release-a")
        self.assertEqual(status.actual_count, 2)
        self.assertEqual(status.database_bytes, 1_000)


class DryRunAndImportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temporary_directory.name) / "source.db"
        create_source_database(self.db_path)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_dry_run_is_read_only_and_reports_rejections(self) -> None:
        report = dry_run(self.db_path)

        self.assertEqual(report.source_count, 3)
        self.assertEqual(report.accepted_count, 2)
        self.assertEqual(report.rejected_count, 1)
        self.assertEqual(report.rejection_reasons, {"invalid_price": 1})
        self.assertEqual(report.missing_fields["title"], 1)
        self.assertEqual(report.missing_fields["area_sqm"], 1)
        self.assertEqual(report.source_sha256_before, report.source_sha256_after)
        self.assertTrue(report.source_unchanged)
        self.assertRegex(report.content_checksum, r"^[0-9a-f]{64}$")
        self.assertGreater(report.normalized_bytes, 0)

    def test_apply_is_idempotent_and_verify_recomputes_checksum(self) -> None:
        store = FakeStore()
        first = apply_dataset(self.db_path, store, batch_size=1)
        second = apply_dataset(self.db_path, store, batch_size=2)

        self.assertEqual(first.release_id, second.release_id)
        self.assertEqual(len(store.rows[first.release_id]), 2)
        verification = verify_dataset(store, first.release_id)
        self.assertTrue(verification.ok)
        self.assertEqual(verification.actual_count, 2)
        self.assertEqual(verification.remote_checksum, first.content_checksum)

    def test_verify_detects_remote_row_tampering(self) -> None:
        store = FakeStore()
        result = apply_dataset(self.db_path, store, batch_size=10)
        row = next(iter(store.rows[result.release_id].values()))
        row["price_monthly"] = int(row["price_monthly"]) + 1

        verification = verify_dataset(store, result.release_id)

        self.assertFalse(verification.ok)
        self.assertNotEqual(
            verification.remote_checksum,
            verification.expected_checksum,
        )

    def test_activation_requires_verified_count_checksum_and_capacity(self) -> None:
        store = FakeStore(database_bytes=MAX_DATABASE_BYTES)
        result = apply_dataset(self.db_path, store, batch_size=10)

        with self.assertRaisesRegex(RuntimeError, "capacity"):
            activate_dataset(store, result.release_id)
        self.assertEqual(store.activation_calls, [])

        store.database_bytes = MAX_DATABASE_BYTES - 1
        activation = activate_dataset(store, result.release_id)
        self.assertEqual(store.activation_calls, [result.release_id])
        self.assertTrue(activation.ok)
        self.assertEqual(activation.status, "active")


if __name__ == "__main__":
    unittest.main()
