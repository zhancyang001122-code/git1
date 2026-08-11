# Supabase 历史房源云端接入 Implementation Plan

> 按 `docs/superpowers/specs/2026-08-12-supabase-historical-housing-design.md` 实施。每个 Task 独立验证、独立 Conventional Commit；未通过当前 Task 的门禁时不进入下一 Task。

**Goal:** 将 60,202 条 2024-11 杭州租房历史快照以安全、版本化、可回滚的方式导入 Supabase，并让 Vercel 上的房源页面与小智使用同一真实历史数据源。

**Architecture:** SQLite 仅作为本机只读来源；导入器清洗并写入非活动 release；Supabase PostGIS + RPC 提供受控查询；Next.js 服务端 Adapter 使用 `SUPABASE_SECRET_KEY` 调用，浏览器只访问 Next API。原 FastAPI 保留为本地回归基线，不进入 Production 路径。

**Tech Stack:** Supabase PostgreSQL 17、PostGIS、RLS、SQL RPC、Python 标准库导入器、Next.js 16 App Router、TypeScript strict、Zod、Vitest、Playwright、pnpm。

## Global Constraints

- 原始 SQLite、导出文件、密钥和完整数据不得提交 Git。
- 只上传白名单字段；禁止 `raw`、联系方式、完整图片集合和内部自增 ID。
- 数据始终标记为 `2024-11` 历史快照，不得描述为实时或当前可租。
- 不补造缺失的 `district`、`address` 或其他字段。
- Live 房源筛选只覆盖源数据能够证明的字段。
- 两张新表必须启用 RLS；浏览器角色不得直接读取。
- 先写失败测试，再写最小实现，再重构。
- 远端导入前必须完成本地 reset、数据库测试、dry-run、容量预估和安全字段审计。
- 最终数据库容量必须低于 400MB；超过阈值时停止激活并请求用户决定。

---

## Task 1: Versioned PostGIS schema, RLS, and search RPC

**Files:**

- Modify: `web/scripts/validate-migrations.mjs`
- Modify: `web/package.json`
- Create: `supabase/migrations/202608120013_historical_housing.sql`
- Create: `supabase/tests/database/historical_housing.test.sql`
- Modify: `supabase/migrations/README.md`
- Create: `docs/task-reports/2026-08-12-historical-housing-schema.md`

**Interfaces:**

- `public.housing_dataset_releases`
- `public.historical_houses`
- `public.search_historical_houses(...)`
- `public.activate_housing_dataset(uuid)`

### Step 1: Extend the static migration verifier and prove RED

Add assertions for:

- PostGIS in `extensions`.
- Both tables exist and have RLS.
- No anon/authenticated read policy or table grant exists.
- RPC has a fixed search path, bounded limit/radius, active-release filter and service-role-only execute grant.
- Spatial and business indexes exist.

Run:

```powershell
cd web
pnpm db:check
```

Expected: fail because migration 013 does not exist.

### Step 2: Implement the migration

Create the release table, historical table, generated WGS84 geography point, constraints, indexes, RLS, explicit revokes, search RPC and transactional activation RPC. Use fully qualified objects and `set search_path = ''`.

The search RPC must:

- Validate min/max price, coordinates, radius, sort, offset and limit.
- Query only the active release.
- Support city, price, rent type, bedrooms and optional nearby radius.
- Return only product-safe fields plus `distance_m` and total count.
- Use deterministic ordering with `id` as final tie-breaker.

### Step 3: Write pgTAP database tests

Cover schema, constraints, RLS enabled state, privileges, inactive-release invisibility, activation, price/bedroom/radius filters, distance ordering, result limits and absence of forbidden columns.

Run static verifier again; expected PASS.

### Step 4: Validate with local Supabase

```powershell
cd web
pnpm db:start
pnpm exec supabase --workdir .. db reset
pnpm exec supabase --workdir .. test db
pnpm exec supabase --workdir .. db lint --level warning
```

Record exact evidence. Do not claim database success if Docker or the local stack did not run.

### Step 5: Run repository quality gates and commit

```powershell
cd web
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Commit:

```text
feat(housing): add versioned PostGIS search schema
```

---

## Task 2: Deterministic SQLite normalizer and idempotent importer

**Files:**

- Create: `scripts/housing-import/housing_import.py`
- Create: `scripts/housing-import/test_housing_import.py`
- Create: `scripts/housing-import/README.md`
- Modify: `.gitignore`
- Create: `docs/task-reports/2026-08-12-historical-housing-importer.md`

**Interfaces:**

```text
housing_import.py audit --db <path>
housing_import.py dry-run --db <path> --report <path>
housing_import.py apply --db <path> --batch-size 500
housing_import.py verify --release-id <uuid>
housing_import.py activate --release-id <uuid>
```

### Step 1: Write failing normalizer tests

Test deterministic UUIDv5, SHA-256 source key, URL allowlist, text truncation, bedroom parsing, null preservation, invalid coordinate/price rejection, stable checksum and no forbidden output keys.

### Step 2: Implement read-only extraction and dry-run

Open SQLite with `mode=ro`; never initialize or mutate it. Stream rows instead of loading all raw records into memory. Produce aggregate statistics and normalized-byte estimate without writing data files unless `--report` is explicitly provided.

### Step 3: Implement remote batch import

Use `NEXT_PUBLIC_SUPABASE_URL` plus server-only `SUPABASE_SECRET_KEY`. Create an `importing` release, upsert fixed-size batches, retry idempotent transient failures once, stop on validation/auth/quota errors, and never print key values.

`apply` must not activate. `verify` compares expected/imported/remote counts and checksum. `activate` refuses unless verification passed and the capacity audit is below 400MB.

### Step 4: Run against the real SQLite in dry-run mode

Record source count, accepted/rejected rows, missing-field counts, normalized byte estimate and checksum. Confirm the source file hash is unchanged before and after.

### Step 5: Verify and commit

Run Python unit tests, Ruff if available, static migration check and full Web gates. Commit:

```text
feat(housing): add deterministic Supabase importer
```

---

## Task 3: Supabase housing adapter and runtime selection

**Files:**

- Create: `web/src/features/housing/supabase-adapter.ts`
- Create: `web/src/features/housing/__tests__/supabase-adapter.test.ts`
- Modify: `web/src/features/housing/types.ts`
- Modify: `web/src/features/housing/runtime.ts`
- Modify: `web/src/features/housing/__tests__/runtime.test.ts`
- Modify: `web/src/lib/env.ts`
- Modify: `web/.env.example`

**Interfaces:**

- `HistoricalHousingSupabaseAdapter implements HousingSearchService`
- `HousingRuntime.mode = "supabase" | "http" | "unavailable"`

### Step 1: Write failing adapter contract tests

Cover RPC argument mapping, longitude/latitude order, nullable fields, Zod rejection, stable errors, source metadata, timeout/abort and no secret leakage.

### Step 2: Implement the server-only adapter

Call `search_historical_houses` through a server-only Supabase client. Convert database snake_case to the existing `HistoricalHousingSearchResult`; no Supabase row type may escape the adapter.

### Step 3: Select runtime deterministically

Production/Live prefers Supabase when URL and secret are configured. HTTP is an explicit local-only fallback. Missing configuration returns `unavailable`; it does not silently claim Live.

### Step 4: Verify and commit

Run focused tests and full gates. Commit:

```text
feat(housing): query historical homes through Supabase
```

---

## Task 4: Align product contract and remove unsupported filters

**Files:**

- Modify: `contracts/tool-contracts.json`
- Modify: `contracts/api-contracts.md`
- Modify: `contracts/domain-types.ts`
- Modify: `contracts/qwen-system-prompt.md`
- Modify: `docs/00-project-brief.md`
- Modify: `docs/01-PRD.md`
- Modify: `docs/04-page-specifications.md`
- Modify: `docs/05-ai-agent-architecture.md`
- Modify: `docs/11-acceptance-criteria.md`
- Modify: `docs/14-configuration-guide.md`
- Modify: `docs/15-knowledge-material-intake.md`
- Modify: `qa/demo-script.md`
- Modify: `qa/evaluation-cases.json`
- Modify: `web/src/features/agent/tools/schemas.ts`
- Modify: `web/src/features/agent/tools/business-tools.ts`
- Modify: `web/src/features/agent/demo-tool-provider.ts`
- Modify: `web/src/features/agent/result-synthesizer.ts`
- Modify: `web/src/features/agent/system-prompt.ts`
- Modify: `web/src/features/business/domain.ts`
- Modify: `web/src/features/business/{api-handlers,demo-data,demo-repository,mappers,supabase-repository}.ts`
- Modify: `web/src/components/business/{house-card,house-detail,house-list-experience}.tsx`
- Modify: `web/src/components/home/home-search-experience.tsx`
- Modify: `web/src/components/pages/xiaozhi-welcome-page.tsx`
- Modify: `web/src/components/account/{account-experiences,preferences-experience}.tsx`
- Modify: housing, agent, business, component, evaluation and E2E tests that assert the old contract

### Step 1: Write failing contract and UI tests

Assert the Live house contract exposes only city, price, rent type/bedrooms, near location and limit; default filters, prompts and demos contain no unsupported field requirement.

### Step 2: Update root contracts first

Remove unsupported filtering from the authoritative tool/API/PRD/QA contracts. Replace the core demo query with a verifiable example such as “武林广场附近、3500 元以下的一居室，再看看附近地铁和超市”。

### Step 3: Update code and fixtures

Regenerate or hand-update Zod schemas, demo provider, repository filters, UI controls, cards and tests. Missing historical fields render as “暂无记录” and are not represented as false values.

### Step 4: Verify and commit

Run all housing, agent, business, component, evaluation and E2E contract tests. As a current-scope audit, search `contracts/`, active product docs, `qa/`, `web/src/` and `web/e2e/` for the removed requirement; archived specs and task reports remain historical evidence. Commit:

```text
refactor(housing): align filters with verified history data
```

---

## Task 5: Switch pages and Agent to the cloud history source

**Files:**

- Modify: `web/src/features/agent/tools/business-tools.ts`
- Modify: `web/src/features/repositories.ts`
- Modify: `web/src/features/business/api-handlers.ts`
- Modify: `web/src/app/houses/page.tsx`
- Modify: `web/src/app/api/houses/route.ts`
- Modify: `web/src/components/business/{house-card,house-detail,house-list-experience}.tsx`
- Modify: `web/src/components/chat/agent-result-cards.tsx`
- Modify: `web/src/components/ui/source-badge.tsx`
- Modify: `web/src/features/housing/__tests__/{runtime,supabase-adapter}.test.ts`
- Modify: `web/src/features/business/__tests__/api-handlers.test.ts`
- Modify: `web/src/features/agent/tools/__tests__/business-tools.test.ts`
- Modify: `web/src/components/business/__tests__/{business-cards,housing-deal-experiences}.test.tsx`
- Modify: `web/src/components/chat/__tests__/agent-result-cards.test.tsx`
- Modify: `web/src/components/ui/__tests__/controls.test.tsx`
- Replace/Modify: `web/e2e/housing-http.spec.ts` with Supabase Live coverage

### Step 1: Write failing integration tests

Use a fake RPC client to prove `/api/houses` and `search_houses` receive the same release metadata and records. Cover source badge, null rendering, pagination, location query, Supabase failure and explicit Demo fallback.

### Step 2: Wire the shared housing service

Both page API and Agent tool use `HousingSearchService`. AMap resolves named locations before radius search; WGS84/GCJ-02 conversion remains explicit and tested.

### Step 3: Update E2E behavior

Test historical label, no realtime claim, structured cards, map partial failure and source consistency. Remove the local FastAPI requirement from the Production E2E path.

### Step 4: Verify and commit

Run full unit, E2E and build gates. Commit:

```text
feat(housing): serve cloud history across pages and chat
```

---

## Task 6: Remote migration, inactive import, audit, and activation

**External actions:** Existing linked Supabase project only. No production activation until all gates below pass.

### Step 1: Confirm remote migration history and secret configuration

Run non-mutating checks first. If the CLI requires login or the project link is stale, stop and guide the user through only the required UI/CLI action.

### Step 2: Push migration 013

Apply through `supabase db push`, never by manually editing the remote Table Editor. Verify table/RPC definitions and direct-access denial.

### Step 3: Import as inactive

Run dry-run again, then `apply`. Verify row counts, checksum, duplicate count, forbidden-field absence and query plans. The public product remains on its previous source while the release is inactive.

### Step 4: Check capacity and performance

Measure actual database size and relation/index sizes. Require total database size below 400MB. Run representative filters and nearby searches; record P50/P95 over a repeatable sample.

### Step 5: Activate transactionally

Activate only after all checks pass. Rerun RLS, RPC, Next API and Agent smoke checks. If activation causes errors, reactivate the prior release or mark the new release failed.

### Step 6: Record evidence and commit

Create a remote-import task report without secrets or private URLs. Commit:

```text
test(housing): verify remote historical dataset
```

---

## Task 7: Production release cleanup and interview evidence

**Files:**

- Modify: `docs/11-acceptance-criteria.md`
- Modify: `web/docs/deployment.md`
- Modify: `web/docs/runbook.md`
- Modify: root and Web README files
- Modify: housing HTTP documentation to mark it as a retired local prototype
- Create: final housing release report

### Step 1: Remove obsolete Production configuration

Remove Vercel dependence on `HOUSING_API_BASE_URL` and `HOUSING_API_KEY`. Keep only documented local prototype instructions if the code remains.

### Step 2: Run completion audit

Map every design acceptance item to current evidence: migration, pgTAP, importer report, remote counts/checksum/capacity, RLS denial, RPC result, API result, Agent result, E2E and source labels.

### Step 3: Run final quality gates

```powershell
cd web
pnpm db:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

### Step 4: Commit and push

Commit:

```text
docs(housing): document verified cloud data release
```

Push the branch after every verified Conventional Commit. Do not create a Git tag until the whole interview release—not merely this housing task—passes its final release gate.
