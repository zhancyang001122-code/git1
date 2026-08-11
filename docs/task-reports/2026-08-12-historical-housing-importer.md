# Historical housing importer task report

Date: 2026-08-12
Scope: deterministic SQLite normalization, safe Supabase import lifecycle, and
local end-to-end verification.

## Outcome

Implemented a standard-library Python importer with five explicit commands:
`audit`, `dry-run`, `apply`, `verify`, and `activate`. The source SQLite file is
opened read-only. Upload and activation are deliberately separate, and an
activation must pass remote count, checksum, and database-capacity checks.

No remote Supabase migration or data write was performed in this task.

## TDD evidence

The first Python test run failed because the importer module did not exist.
After implementation, 13 unit tests pass. A later regression test first proved
that activation output incorrectly returned the pre-activation `importing`
state; the implementation now re-reads the release and only succeeds when the
reported state is `active`.

The migration verifier first failed because the import-observability migration
was absent. The new service-role-only status RPC is covered by 10 pgTAP tests;
the historical schema and importer status suites now pass 36 database tests.

## Real source dry-run

| Metric                      |                                                             Result |
| --------------------------- | -----------------------------------------------------------------: |
| Source rows                 |                                                             60,202 |
| Accepted rows               |                                                             60,202 |
| Rejected rows               |                                                                  0 |
| Normalized byte estimate    |                                                         36,176,050 |
| Release ID                  |                             `5b640272-0dec-5dd8-b12a-45786ef1a60e` |
| Dataset checksum            | `3e3173b992adc372ddb262dd4b9ecd6b3444393c88cb281c32b071500cf672ae` |
| Source SHA-256 before/after |                                                          identical |
| Source unchanged            |                                                                yes |

Source SHA-256:
`b16b7bb3e9f62c95a597b560735420049d2878f6231c6d992d39838ea5b787ee`.

Missing optional values were preserved as null rather than invented. The
source has no district or address values (60,202 missing each). It also has 438
missing titles, communities, rent types, layouts, bedrooms, floors, and
orientations, plus 453 missing areas. Every source URL passed the HTTP/HTTPS
allowlist.

## Local Supabase end-to-end proof

Using the reset local Supabase stack only:

1. `apply` uploaded 60,202 rows in fixed batches and left the release in
   `importing`.
2. `verify` fetched the remote representation in pages, recomputed all row
   digests, and matched count `60,202` and the dry-run checksum.
3. The measured local database size was 72,199,315 bytes before activation,
   below the 400,000,000-byte safety limit.
4. `activate` returned a confirmed `active` status with the same remote
   checksum. The post-activation database size was 72,256,659 bytes.
5. Re-running `apply` returned `resumed: true` and `already_active: true`,
   proving the active-release path is idempotent.

The local database was reset after this proof so pgTAP fixtures ran from a
clean state. The first pgTAP rerun correctly exposed the leftover integration
release as a duplicate test fixture; after the documented local reset, both
test files passed.

## Safety and access boundaries

- The repository ignores SQLite source files and generated dry-run reports.
- Only allowlisted normalized columns are uploaded; raw payload and image
  columns are not read into the target record.
- Source identifiers are represented by SHA-256, not exposed directly.
- Supabase access requires `NEXT_PUBLIC_SUPABASE_URL` plus a server-only
  `sb_secret_` key.
- Transient HTTP failures retry once; auth, validation, and quota failures stop.
- Error messages redact the secret value.
- Import-status and activation RPCs are unavailable to `anon` and
  `authenticated` roles.

## Verification gates

- Ruff: pass
- mypy `--strict`: pass
- Python unittest: 13/13 pass
- migration validation: 14 migrations, 28 tables, complete RLS coverage
- pgTAP: 2 files, 36 tests pass
- ESLint: pass
- Next.js route type generation + TypeScript: pass
- Vitest: 104 files, 375 tests pass
- Next.js production build: pass, 42 pages generated

## Next boundary

The importer is ready, but the cloud database is intentionally untouched. The
next implementation task is the Web housing repository/adapter and contract
tests. Remote migration, capacity preflight, upload, verification, and
activation remain a later explicit deployment task.
