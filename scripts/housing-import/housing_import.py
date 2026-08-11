from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import uuid
from collections import Counter
from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
from dataclasses import asdict, dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

DATASET_PERIOD = "2024-11"
SOURCE_LABEL = "2024年11月杭州租房历史快照"
DISCLAIMER = "仅供历史房源参考，不代表当前仍可出租或当前价格"
MAX_DATABASE_BYTES = 400_000_000
MAX_BATCH_SIZE = 1_000
PAGE_SIZE = 1_000
IMPORT_NAMESPACE = uuid.UUID("fcb88e83-741a-4a61-a91f-7f2f0c1c90df")

SOURCE_COLUMNS = (
    "external_id",
    "source",
    "title",
    "url",
    "price",
    "rent_type",
    "layout",
    "area",
    "floor",
    "orientation",
    "community",
    "address",
    "city",
    "district",
    "lat",
    "lng",
)
OUTPUT_COLUMNS = (
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
)
MISSING_FIELD_COLUMNS = (
    "title",
    "district",
    "address",
    "community",
    "rent_type",
    "layout",
    "bedrooms",
    "area_sqm",
    "floor",
    "orientation",
    "source_url",
)
REMOTE_SELECT = ",".join(OUTPUT_COLUMNS)


class RowRejected(ValueError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class SupabaseRequestError(RuntimeError):
    def __init__(self, message: str, *, status: int | None, retryable: bool) -> None:
        super().__init__(message)
        self.status = status
        self.retryable = retryable


@dataclass(frozen=True)
class DryRunReport:
    dataset_period: str
    release_id: str
    source_path: str
    source_size_bytes: int
    source_sha256_before: str
    source_sha256_after: str
    source_unchanged: bool
    source_count: int
    accepted_count: int
    rejected_count: int
    rejection_reasons: dict[str, int]
    missing_fields: dict[str, int]
    normalized_bytes: int
    content_checksum: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class ApplyResult:
    release_id: str
    expected_count: int
    imported_count: int
    content_checksum: str
    resumed: bool
    already_active: bool


@dataclass(frozen=True)
class ImportStatus:
    release_id: str
    status: str
    expected_count: int
    imported_count: int
    actual_count: int
    content_checksum: str
    table_bytes: int
    index_bytes: int
    database_bytes: int


@dataclass(frozen=True)
class VerificationResult:
    release_id: str
    ok: bool
    status: str
    expected_count: int
    imported_count: int
    actual_count: int
    expected_checksum: str
    remote_checksum: str
    database_bytes: int


class HousingStore(Protocol):
    def prepare_release(self, release: dict[str, object]) -> dict[str, object]: ...

    def upsert_rows(self, release_id: str, rows: list[dict[str, object]]) -> None: ...

    def update_imported_count(self, release_id: str, count: int) -> None: ...

    def iter_rows(self, release_id: str) -> Iterable[Mapping[str, object]]: ...

    def get_import_status(self, release_id: str) -> ImportStatus: ...

    def activate(self, release_id: str) -> None: ...


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


HttpTransport = Callable[
    [str, str, Mapping[str, str], bytes | None, float], HttpResponse
]


def _clean_text(value: object, maximum: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:maximum]


def _required_text(value: object, maximum: int, reason: str) -> str:
    text = _clean_text(value, maximum)
    if text is None:
        raise RowRejected(reason)
    return text


def _decimal(value: object, reason: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise RowRejected(reason) from error
    if not number.is_finite():
        raise RowRejected(reason)
    return number


def _monthly_price(value: object) -> int:
    number = _decimal(value, "invalid_price")
    if number <= 0 or number > 1_000_000:
        raise RowRejected("invalid_price")
    integral = number.to_integral_value()
    if number != integral:
        raise RowRejected("non_integral_price")
    return int(integral)


def _coordinate(value: object, *, latitude: bool) -> float:
    number = _decimal(value, "invalid_coordinates")
    minimum, maximum = (-90, 90) if latitude else (-180, 180)
    if number < minimum or number > maximum:
        raise RowRejected("invalid_coordinates")
    return float(number.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def _area(value: object) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not number.is_finite() or number <= 0 or number >= Decimal(100000):
        return None
    return float(number.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _safe_url(value: object) -> str | None:
    text = _clean_text(value, 2_048)
    if text is None:
        return None
    parsed = urlsplit(text)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        return None
    return text


def parse_bedrooms(layout: object) -> int | None:
    text = _clean_text(layout, 80)
    if text is None:
        return None
    match = re.match(r"^(\d{1,2})室", text)
    if match is None:
        return None
    value = int(match.group(1))
    return value if 0 <= value <= 20 else None


def release_id_for_period(dataset_period: str = DATASET_PERIOD) -> str:
    return str(uuid.uuid5(IMPORT_NAMESPACE, f"release:{dataset_period}"))


def normalize_row(
    row: Mapping[str, object],
    *,
    release_id: str,
    dataset_period: str = DATASET_PERIOD,
) -> dict[str, object]:
    source = _required_text(row.get("source"), 100, "missing_source_key")
    external_id = _required_text(row.get("external_id"), 300, "missing_source_key")
    source_key = f"{source}:{external_id}"
    city = _required_text(row.get("city"), 40, "missing_city")
    record_id = uuid.uuid5(
        IMPORT_NAMESPACE,
        f"house:{dataset_period}:{source_key}",
    )
    return {
        "id": str(record_id),
        "release_id": release_id,
        "dataset_period": dataset_period,
        "source_key_hash": hashlib.sha256(source_key.encode("utf-8")).hexdigest(),
        "title": _clean_text(row.get("title"), 300),
        "city": city,
        "district": _clean_text(row.get("district"), 80),
        "address": _clean_text(row.get("address"), 300),
        "community": _clean_text(row.get("community"), 200),
        "price_monthly": _monthly_price(row.get("price")),
        "rent_type": _clean_text(row.get("rent_type"), 40),
        "layout": _clean_text(row.get("layout"), 80),
        "bedrooms": parse_bedrooms(row.get("layout")),
        "area_sqm": _area(row.get("area")),
        "floor": _clean_text(row.get("floor"), 100),
        "orientation": _clean_text(row.get("orientation"), 100),
        "longitude": _coordinate(row.get("lng"), latitude=False),
        "latitude": _coordinate(row.get("lat"), latitude=True),
        "source_url": _safe_url(row.get("url")),
    }


def _fixed_decimal(value: object, places: str) -> str | None:
    if value is None:
        return None
    number = Decimal(str(value)).quantize(Decimal(places), rounding=ROUND_HALF_UP)
    return format(number, "f")


def _digest_payload(row: Mapping[str, object]) -> bytes:
    payload = {column: row.get(column) for column in OUTPUT_COLUMNS}
    payload["area_sqm"] = _fixed_decimal(payload["area_sqm"], "0.01")
    payload["longitude"] = _fixed_decimal(payload["longitude"], "0.000001")
    payload["latitude"] = _fixed_decimal(payload["latitude"], "0.000001")
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


class DatasetDigest:
    _MODULUS = 1 << 256

    def __init__(self) -> None:
        self.count = 0
        self.normalized_bytes = 0
        self._sum = 0

    def update(self, row: Mapping[str, object]) -> None:
        payload = _digest_payload(row)
        record_hash = int.from_bytes(hashlib.sha256(payload).digest(), "big")
        self._sum = (self._sum + record_hash) % self._MODULUS
        self.count += 1
        self.normalized_bytes += len(payload) + 1

    def hexdigest(self) -> str:
        summary = f"housing-v1:{self.count}:{self._sum:064x}".encode("ascii")
        return hashlib.sha256(summary).hexdigest()


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _readonly_connection(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise FileNotFoundError(f"housing database was not found: {path}")
    connection = sqlite3.connect(
        f"{path.resolve().as_uri()}?mode=ro&immutable=1",
        uri=True,
    )
    connection.row_factory = sqlite3.Row
    connection.execute("pragma query_only = on")
    columns = {
        str(row["name"])
        for row in connection.execute("pragma table_info(listings)").fetchall()
    }
    missing = sorted(set(SOURCE_COLUMNS) - columns)
    if missing:
        connection.close()
        raise RuntimeError(f"housing database schema is missing: {','.join(missing)}")
    return connection


def _iter_source_rows(path: Path) -> Iterator[dict[str, object]]:
    connection = _readonly_connection(path)
    try:
        query = f"select {','.join(SOURCE_COLUMNS)} from listings order by source, external_id"
        cursor = connection.execute(query)
        while True:
            rows = cursor.fetchmany(1_000)
            if not rows:
                return
            yield from (dict(row) for row in rows)
    finally:
        connection.close()


def _iter_normalized_rows(
    path: Path,
    *,
    release_id: str,
    dataset_period: str,
) -> Iterator[dict[str, object]]:
    for row in _iter_source_rows(path):
        try:
            yield normalize_row(
                row,
                release_id=release_id,
                dataset_period=dataset_period,
            )
        except RowRejected:
            continue


def dry_run(
    db_path: str | Path,
    *,
    dataset_period: str = DATASET_PERIOD,
) -> DryRunReport:
    path = Path(db_path).resolve()
    release_id = release_id_for_period(dataset_period)
    source_hash_before = _file_sha256(path)
    source_count = 0
    rejected = Counter[str]()
    missing_fields = Counter[str]()
    digest = DatasetDigest()

    for row in _iter_source_rows(path):
        source_count += 1
        try:
            normalized = normalize_row(
                row,
                release_id=release_id,
                dataset_period=dataset_period,
            )
        except RowRejected as error:
            rejected[error.reason] += 1
            continue
        digest.update(normalized)
        for field in MISSING_FIELD_COLUMNS:
            if normalized[field] is None:
                missing_fields[field] += 1

    source_hash_after = _file_sha256(path)
    return DryRunReport(
        dataset_period=dataset_period,
        release_id=release_id,
        source_path=str(path),
        source_size_bytes=path.stat().st_size,
        source_sha256_before=source_hash_before,
        source_sha256_after=source_hash_after,
        source_unchanged=source_hash_before == source_hash_after,
        source_count=source_count,
        accepted_count=digest.count,
        rejected_count=sum(rejected.values()),
        rejection_reasons=dict(sorted(rejected.items())),
        missing_fields={
            field: missing_fields.get(field, 0) for field in MISSING_FIELD_COLUMNS
        },
        normalized_bytes=digest.normalized_bytes,
        content_checksum=digest.hexdigest(),
    )


def _batches(
    rows: Iterable[dict[str, object]], batch_size: int
) -> Iterator[list[dict[str, object]]]:
    if not 1 <= batch_size <= MAX_BATCH_SIZE:
        raise ValueError(f"batch_size must be between 1 and {MAX_BATCH_SIZE}")
    batch: list[dict[str, object]] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def apply_dataset(
    db_path: str | Path,
    store: HousingStore,
    *,
    batch_size: int = 500,
    dataset_period: str = DATASET_PERIOD,
) -> ApplyResult:
    report = dry_run(db_path, dataset_period=dataset_period)
    if not report.source_unchanged:
        raise RuntimeError("source database changed during dry-run")
    if report.accepted_count <= 0:
        raise RuntimeError("no valid historical housing rows were found")
    release = {
        "id": report.release_id,
        "dataset_period": dataset_period,
        "source_label": SOURCE_LABEL,
        "disclaimer": DISCLAIMER,
        "status": "importing",
        "expected_count": report.accepted_count,
        "imported_count": 0,
        "content_checksum": report.content_checksum,
    }
    prepared = store.prepare_release(release)
    prepared_status = str(prepared.get("status", "importing"))
    if prepared_status == "active":
        verification = verify_dataset(store, report.release_id)
        if not verification.ok:
            raise RuntimeError("active release does not match the local dataset")
        return ApplyResult(
            release_id=report.release_id,
            expected_count=report.accepted_count,
            imported_count=verification.actual_count,
            content_checksum=report.content_checksum,
            resumed=True,
            already_active=True,
        )
    if prepared_status != "importing":
        raise RuntimeError(f"release status is not resumable: {prepared_status}")

    imported_count = 0
    rows = _iter_normalized_rows(
        Path(db_path).resolve(),
        release_id=report.release_id,
        dataset_period=dataset_period,
    )
    for batch in _batches(rows, batch_size):
        store.upsert_rows(report.release_id, batch)
        imported_count += len(batch)
        store.update_imported_count(report.release_id, imported_count)

    if imported_count != report.accepted_count:
        raise RuntimeError("imported row count changed after dry-run")
    return ApplyResult(
        release_id=report.release_id,
        expected_count=report.accepted_count,
        imported_count=imported_count,
        content_checksum=report.content_checksum,
        resumed=bool(prepared.get("imported_count", 0)),
        already_active=False,
    )


def verify_dataset(store: HousingStore, release_id: str) -> VerificationResult:
    status = store.get_import_status(release_id)
    digest = DatasetDigest()
    for row in store.iter_rows(release_id):
        digest.update(row)
    remote_checksum = digest.hexdigest()
    ok = (
        digest.count == status.expected_count
        and status.actual_count == status.expected_count
        and status.imported_count == status.expected_count
        and remote_checksum == status.content_checksum
    )
    return VerificationResult(
        release_id=release_id,
        ok=ok,
        status=status.status,
        expected_count=status.expected_count,
        imported_count=status.imported_count,
        actual_count=status.actual_count,
        expected_checksum=status.content_checksum,
        remote_checksum=remote_checksum,
        database_bytes=status.database_bytes,
    )


def activate_dataset(store: HousingStore, release_id: str) -> VerificationResult:
    verification = verify_dataset(store, release_id)
    if not verification.ok:
        raise RuntimeError("verification failed; release was not activated")
    if verification.database_bytes >= MAX_DATABASE_BYTES:
        raise RuntimeError("capacity limit reached; release was not activated")
    store.activate(release_id)
    activated = verify_dataset(store, release_id)
    if not activated.ok or activated.status != "active":
        raise RuntimeError("release activation could not be confirmed")
    return activated


def _urllib_transport(
    method: str,
    url: str,
    headers: Mapping[str, str],
    body: bytes | None,
    timeout: float,
) -> HttpResponse:
    request = Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            return HttpResponse(
                status=response.status,
                headers=dict(response.headers.items()),
                body=response.read(),
            )
    except HTTPError as error:
        return HttpResponse(
            status=error.code,
            headers=dict(error.headers.items()) if error.headers else {},
            body=error.read(),
        )
    except URLError as error:
        raise SupabaseRequestError(
            "Supabase network request failed",
            status=None,
            retryable=True,
        ) from error


class SupabaseHousingStore:
    def __init__(
        self,
        *,
        base_url: str,
        secret_key: str,
        timeout_seconds: float = 30,
        transport: HttpTransport = _urllib_transport,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        parsed = urlsplit(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("NEXT_PUBLIC_SUPABASE_URL is invalid")
        if not secret_key.startswith("sb_secret_"):
            raise ValueError("SUPABASE_SECRET_KEY must use a new sb_secret_ key")
        self.base_url = base_url.rstrip("/") + "/"
        self.secret_key = secret_key
        self.timeout_seconds = timeout_seconds
        self.transport = transport
        self.sleeper = sleeper

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, object] | None = None,
        payload: object | None = None,
        prefer: str | None = None,
    ) -> tuple[object | None, Mapping[str, str]]:
        url = urljoin(self.base_url, path.lstrip("/"))
        if query:
            url = f"{url}?{urlencode(query)}"
        body = None
        headers = {
            "accept": "application/json",
            "apikey": self.secret_key,
            "authorization": f"Bearer {self.secret_key}",
            "user-agent": "xiaozhi-housing-import/1.0",
        }
        if payload is not None:
            body = json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
            headers["content-type"] = "application/json"
        if prefer:
            headers["prefer"] = prefer

        response: HttpResponse | None = None
        for attempt in range(2):
            try:
                response = self.transport(
                    method,
                    url,
                    headers,
                    body,
                    self.timeout_seconds,
                )
            except SupabaseRequestError:
                if attempt == 0:
                    self.sleeper(0.25)
                    continue
                raise
            retryable = response.status in {408, 429, 500, 502, 503, 504}
            if response.status < 400:
                break
            if retryable and attempt == 0:
                self.sleeper(0.25)
                continue
            detail = response.body.decode("utf-8", errors="replace")[:500]
            if self.secret_key in detail:
                detail = detail.replace(self.secret_key, "[redacted]")
            raise SupabaseRequestError(
                f"Supabase request failed with HTTP {response.status}: {detail}",
                status=response.status,
                retryable=retryable,
            )
        if response is None:
            raise SupabaseRequestError(
                "Supabase request failed",
                status=None,
                retryable=True,
            )
        parsed_body: object | None = None
        if response.body.strip():
            try:
                parsed_body = json.loads(response.body)
            except json.JSONDecodeError as error:
                raise SupabaseRequestError(
                    "Supabase returned invalid JSON",
                    status=response.status,
                    retryable=False,
                ) from error
        return parsed_body, response.headers

    def prepare_release(self, release: dict[str, object]) -> dict[str, object]:
        release_id = str(release["id"])
        data, _ = self._request(
            "GET",
            "/rest/v1/housing_dataset_releases",
            query={
                "select": "id,status,expected_count,imported_count,content_checksum",
                "id": f"eq.{release_id}",
                "limit": 1,
            },
        )
        rows = data if isinstance(data, list) else []
        if rows:
            current = rows[0]
            if not isinstance(current, dict):
                raise SupabaseRequestError(
                    "Supabase release response is invalid",
                    status=200,
                    retryable=False,
                )
            if (
                current.get("content_checksum") != release["content_checksum"]
                or current.get("expected_count") != release["expected_count"]
            ):
                raise RuntimeError("existing release conflicts with the local dataset")
            return current
        created, _ = self._request(
            "POST",
            "/rest/v1/housing_dataset_releases",
            payload=release,
            prefer="return=representation",
        )
        if (
            not isinstance(created, list)
            or not created
            or not isinstance(created[0], dict)
        ):
            raise SupabaseRequestError(
                "Supabase did not return the created release",
                status=201,
                retryable=False,
            )
        return created[0]

    def upsert_rows(self, release_id: str, rows: list[dict[str, object]]) -> None:
        if any(str(row.get("release_id")) != release_id for row in rows):
            raise ValueError("batch contains a different release id")
        self._request(
            "POST",
            "/rest/v1/historical_houses",
            query={"on_conflict": "id"},
            payload=rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def update_imported_count(self, release_id: str, count: int) -> None:
        self._request(
            "PATCH",
            "/rest/v1/housing_dataset_releases",
            query={"id": f"eq.{release_id}"},
            payload={"imported_count": count},
            prefer="return=minimal",
        )

    def iter_rows(self, release_id: str) -> Iterator[Mapping[str, object]]:
        offset = 0
        while True:
            data, _ = self._request(
                "GET",
                "/rest/v1/historical_houses",
                query={
                    "select": REMOTE_SELECT,
                    "release_id": f"eq.{release_id}",
                    "order": "id.asc",
                    "offset": offset,
                    "limit": PAGE_SIZE,
                },
            )
            if not isinstance(data, list):
                raise SupabaseRequestError(
                    "Supabase row response is invalid",
                    status=200,
                    retryable=False,
                )
            for row in data:
                if not isinstance(row, dict):
                    raise SupabaseRequestError(
                        "Supabase row response is invalid",
                        status=200,
                        retryable=False,
                    )
                yield row
            if len(data) < PAGE_SIZE:
                return
            offset += len(data)

    def get_import_status(self, release_id: str) -> ImportStatus:
        data, _ = self._request(
            "POST",
            "/rest/v1/rpc/get_housing_import_status",
            payload={"p_release_id": release_id},
        )
        rows = data if isinstance(data, list) else []
        if not rows or not isinstance(rows[0], dict):
            raise RuntimeError("housing import status was not found")
        row = rows[0]
        return ImportStatus(
            release_id=release_id,
            status=str(row["status"]),
            expected_count=int(row["expected_count"]),
            imported_count=int(row["imported_count"]),
            actual_count=int(row["actual_count"]),
            content_checksum=str(row["content_checksum"]),
            table_bytes=int(row["table_bytes"]),
            index_bytes=int(row["index_bytes"]),
            database_bytes=int(row["database_bytes"]),
        )

    def activate(self, release_id: str) -> None:
        self._request(
            "POST",
            "/rest/v1/rpc/activate_housing_dataset",
            payload={"p_release_id": release_id},
        )


def _store_from_environment() -> SupabaseHousingStore:
    base_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    secret_key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if not base_url or not secret_key:
        raise RuntimeError(
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required"
        )
    return SupabaseHousingStore(base_url=base_url, secret_key=secret_key)


def _write_report(path: Path, report: DryRunReport) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _safe_json(
    value: DryRunReport | ApplyResult | VerificationResult,
) -> str:
    return json.dumps(asdict(value), ensure_ascii=False, indent=2)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Audit and import the approved historical housing snapshot."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("audit", "dry-run"):
        command = subparsers.add_parser(name)
        command.add_argument("--db", required=True, type=Path)
        command.add_argument("--dataset-period", default=DATASET_PERIOD)
        if name == "dry-run":
            command.add_argument("--report", type=Path)

    apply_command = subparsers.add_parser("apply")
    apply_command.add_argument("--db", required=True, type=Path)
    apply_command.add_argument("--dataset-period", default=DATASET_PERIOD)
    apply_command.add_argument("--batch-size", type=int, default=500)

    verify_command = subparsers.add_parser("verify")
    verify_command.add_argument("--release-id", required=True)

    activate_command = subparsers.add_parser("activate")
    activate_command.add_argument("--release-id", required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command in {"audit", "dry-run"}:
        report = dry_run(args.db, dataset_period=args.dataset_period)
        if args.command == "dry-run" and args.report:
            _write_report(args.report, report)
        print(_safe_json(report))
        return 0 if report.source_unchanged and report.accepted_count > 0 else 1

    store = _store_from_environment()
    if args.command == "apply":
        apply_result = apply_dataset(
            args.db,
            store,
            batch_size=args.batch_size,
            dataset_period=args.dataset_period,
        )
        print(_safe_json(apply_result))
        return 0
    if args.command == "verify":
        verification = verify_dataset(store, args.release_id)
        print(_safe_json(verification))
        return 0 if verification.ok else 1
    if args.command == "activate":
        activation_verification = activate_dataset(store, args.release_id)
        print(_safe_json(activation_verification))
        return 0
    raise AssertionError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RowRejected, SupabaseRequestError, RuntimeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from None
