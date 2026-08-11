# Historical housing Web adapter task report

Date: 2026-08-12

## Outcome

Implemented `HistoricalHousingSupabaseAdapter` as the server-only boundary
between the application and `search_historical_houses`. Live mode now prefers
Supabase when its project URL and new server secret are configured. The older
HTTP service is available only as an explicit localhost development fallback
and is never selected in production.

No remote database or deployment change was made in this task.

## Contract behavior

- Zod validates every input field before an RPC is created.
- RPC arguments preserve longitude/latitude order and map a recorded layout to
  its explicit bedroom count.
- District and area filters are rejected rather than silently ignored because
  the current RPC/source cannot satisfy them reliably.
- Database snake_case rows are validated and mapped to application types.
- Missing historical fields remain `null`; the adapter does not invent titles,
  addresses, districts, areas, floors, or policies.
- Source label, period, disclaimer, historical/realtime flags, request ID,
  duration, and warnings are returned in a stable envelope.
- Caller cancellation, timeout, provider failure, and malformed rows produce
  stable `AppError` codes.
- Provider error details are not retained in the public error object, preventing
  accidental secret-text leakage.

## TDD evidence

The focused test run initially failed because the adapter module did not exist
and the old runtime could select only HTTP. After implementation, the housing,
environment, and health contract suites pass 31 tests.

## Runtime selection

1. Live mode with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` selects
   `supabase`.
2. When both sources are present, Live still selects Supabase.
3. HTTP requires `HOUSING_HTTP_FALLBACK_ENABLED=true`, a complete URL/key pair,
   a localhost/loopback URL, and a non-production environment.
4. Missing configuration returns `unavailable`; it does not claim Live.

## Verification gates

- ESLint: pass
- Next.js route type generation + TypeScript: pass
- Vitest: 105 files, 386 tests pass
- migration validation: 14 migrations, 28 tables, complete RLS coverage
- pgTAP: 2 files, 36 tests pass
- Next.js production build: pass, 42 pages generated

## Next boundary

The application runtime can now create the Supabase housing service, but the
agent tool and housing UI still contain the old HTTP-only and pet-oriented
conditions. The next task replaces those conditions, provides honest fallbacks
for nullable historical fields, and removes pet emphasis from the active
product experience.
