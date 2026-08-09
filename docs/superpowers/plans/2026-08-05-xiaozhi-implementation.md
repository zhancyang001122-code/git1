# 小智本地生活 AI 服务助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从空目录创建一个部署到 Vercel 的移动端本地生活 AI Agent，完整实现页面、Supabase 业务数据、千问 Function Calling、高德地图、深入 RAG 和知识进化闭环。

**Architecture:** Next.js 应用位于 `web/`；UI 通过 application services 调用独立的 Business、Maps、Knowledge、User ports。Supabase 是当前数据底座，千问负责工具选择和生成，高德提供实时位置服务；所有外部实现可由 fixture/fake 替换。

**Tech Stack:** Next.js App Router、TypeScript strict、Tailwind CSS、pnpm、Supabase PostgreSQL/pgvector、阿里云百炼通义千问、OpenAI-compatible SDK、高德 Web Service API、Zod、Vitest、Testing Library、Playwright、Vercel。

## Global Constraints

- 应用目录固定为 `web/`，Vercel Root Directory 固定为 `web/`。
- 设计宽度 430px；支持 360–430px；页面水平边距 16px；顶部栏 56px；搜索框 48px；底部导航 76px；小智按钮 64px。
- 主导航固定为：首页、推荐、小智、消息、我的。
- 房源、团购、商品和社区内容为明确标注的 Mock；高德数据标注来源；政策答案必须有知识引用。
- 模型不得生成价格、库存、状态、政策、生效日期、POI、路线或精确距离。
- 服务端密钥不得进入浏览器、日志、错误响应或测试快照。
- 工具最多 8 轮，同轮相同工具参数只执行一次；参数使用 strict schema 和 Zod 校验。
- 用户对话只能创建候选知识，不能直接发布。
- 每个 Task 单独提交；未经当前 Task 验证不得进入下一 Task。

---

## File Structure

```text
web/
├── src/app/
│   ├── (main)/                 # 首页、推荐、小智、消息、我的
│   ├── (detail)/               # 业务列表/详情、偏好、反馈、购物车、周边
│   ├── knowledge-admin/        # 演示知识运营
│   └── api/                    # chat、business、preferences、feedback、knowledge、health
├── src/components/
│   ├── layout/                 # mobile canvas、header、bottom nav
│   ├── ui/                     # button、tag、states、source badge
│   ├── business/               # house/deal/product/store/post/message cards
│   └── ai/                     # composer、stream、progress、cards、citations、debug
├── src/features/
│   ├── business/               # domain mapper、repositories、services
│   ├── maps/                   # port、AMap adapter、fixtures
│   ├── knowledge/              # chunking、embedding、hybrid search、rerank、citations
│   ├── agent/                  # provider、tool registry、orchestrator、SSE
│   ├── conversation/           # session/message persistence and summary
│   ├── memory/                 # consented preferences
│   └── knowledge-ops/          # candidates、review、publish、eval
├── src/lib/                    # env、Supabase clients、errors、logging、utilities
├── tests/fixtures/             # external service fixtures
└── e2e/                        # Playwright
```

---

### Task 1: Scaffold, quality gates, and environment contract

**Files:**
- Create: `web/` via create-next-app
- Create: `web/src/lib/env.ts`
- Create: `web/src/lib/errors.ts`
- Create: `web/src/app/api/health/route.ts`
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`
- Create: `web/playwright.config.ts`
- Create: `web/src/app/__tests__/smoke.test.tsx`
- Modify: `web/package.json`
- Copy: `config/.env.example` → `web/.env.example`

**Interfaces:**
- Produces `serverEnv`, `publicEnv`, `getServiceConfiguration()`.
- Produces `AppError(code, message, status, retryable, cause?)` and `toPublicError()`.
- `/api/health` returns `{ app, mode, services: { supabase, qwen, amap } }` with `configured | missing | disabled`.

- [ ] **Step 1: Create the app without overwriting specifications**

Run from repository root:

```bash
pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --turbopack --import-alias '@/*' --use-pnpm
cd web
pnpm add @supabase/ssr @supabase/supabase-js openai zod lucide-react clsx tailwind-merge react-markdown remark-gfm
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test prettier prettier-plugin-tailwindcss
```

- [ ] **Step 2: Add scripts and TypeScript strict checks**

Set `package.json` scripts exactly:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

Keep Next.js `dev`, `build`, `start`, and `lint`. Ensure `tsconfig.json` has `"strict": true` and `"noUncheckedIndexedAccess": true`.

- [ ] **Step 3: Write failing environment tests**

Create `web/src/lib/__tests__/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "../env";

describe("environment contracts", () => {
  it("allows demo mode without external service keys", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_DEMO_MODE: "true" });
    expect(env.NEXT_PUBLIC_DEMO_MODE).toBe(true);
  });

  it("rejects a malformed public Supabase URL", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_DEMO_MODE: "false",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("never includes service role, Qwen or AMap keys in public env", () => {
    const value = parsePublicEnv({
      NEXT_PUBLIC_DEMO_MODE: "true",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      DASHSCOPE_API_KEY: "secret",
      AMAP_WEB_SERVICE_KEY: "secret",
    });
    expect(value).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(value).not.toHaveProperty("DASHSCOPE_API_KEY");
    expect(value).not.toHaveProperty("AMAP_WEB_SERVICE_KEY");
  });
});
```

Run `pnpm test src/lib/__tests__/env.test.ts`; expect failure because `env.ts` does not exist.

- [ ] **Step 4: Implement environment parsing and stable errors**

`env.ts` exports pure parse functions using Zod and lazy getters so build succeeds in explicit demo mode. Convert string booleans and numbers. `serverEnv()` must only be imported from files containing `import "server-only"` or from route handlers.

`errors.ts` must map unknown errors to:

```ts
export interface PublicError {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}
```

Do not serialize `cause` or stack.

- [ ] **Step 5: Add health route tests and implementation**

Test that the route returns status 200, does not contain key values, and reports missing/configured based only on presence. Implement without external network calls.

- [ ] **Step 6: Configure Vitest and Playwright smoke tests**

Vitest uses jsdom and `vitest.setup.ts` imports `@testing-library/jest-dom/vitest`. Playwright starts `pnpm dev` on port 3000 and smoke-checks `/` title.

- [ ] **Step 7: Verify and commit**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git add web config contracts docs design qa supabase codex AGENTS.md README.md
git commit -m "chore: scaffold xiaozhi web application"
```

Expected: all commands exit 0; no external key is needed in demo mode.

---

### Task 2: Design system, mobile shell, and navigation

**Files:**
- Create: `web/src/app/globals.css`
- Create: `web/src/components/layout/mobile-canvas.tsx`
- Create: `web/src/components/layout/app-shell.tsx`
- Create: `web/src/components/layout/page-header.tsx`
- Create: `web/src/components/layout/bottom-navigation.tsx`
- Create: `web/src/components/ui/{button,icon-button,tag,source-badge,search-bar,section-header,states,demo-notice}.tsx`
- Create: `web/src/lib/cn.ts`
- Create: `web/src/components/layout/__tests__/bottom-navigation.test.tsx`
- Create: `web/src/app/dev/components/page.tsx`
- Modify: `web/src/app/layout.tsx`

**Interfaces:**
- `AppShell({ children, activeNav, header?, hideBottomNav? })`.
- `BottomNavigation({ active: "home" | "discover" | "xiaozhi" | "messages" | "me" })`.
- UI components consume token classes only.

- [ ] **Step 1: Write failing navigation and accessibility tests**

Assert exactly five links, correct hrefs, `aria-current="page"` on active item, central Xiaozhi button accessible name, and no duplicate navigation landmark.

- [ ] **Step 2: Implement tokens and canvas**

Copy values from `config/tailwind-theme.css`. `MobileCanvas` uses `max-width:430px`, `min-height:100dvh`, centered desktop background and `overflow-x:clip`. Body must not impose a second 430px wrapper.

- [ ] **Step 3: Implement app shell and navigation**

Navigation uses Lucide icons, 44px minimum targets, 76px base height plus safe area. Main content bottom padding is at least 104px. Central Xiaozhi button is 64px and translated upward 14px.

- [ ] **Step 4: Implement common controls and states**

Every control forwards refs where relevant, supports keyboard focus, and uses semantic elements. `SourceBadge` maps `supabase_mock`, `amap`, `knowledge_base`, `user_memory` to fixed labels; callers cannot invent colors.

- [ ] **Step 5: Build development component gallery**

Show each component in default, loading, disabled, error and selected states. Gate route with `process.env.NODE_ENV !== "development"` by returning `notFound()` outside development.

- [ ] **Step 6: Add viewport E2E test**

For 360, 390 and 430px, assert `document.documentElement.scrollWidth <= window.innerWidth` and navigation remains visible.

- [ ] **Step 7: Verify and commit**

Run full Task 1 gate plus `pnpm test:e2e --grep "mobile shell"`, then commit `feat: add unified mobile design system`.

---

### Task 3: Complete page routes with typed demo repository

**Files:**
- Create: route files listed in `config/routes.json`
- Create: `web/src/features/business/domain.ts`
- Create: `web/src/features/business/repository.ts`
- Create: `web/src/features/business/demo-repository.ts`
- Create: `web/src/features/business/demo-data.ts`
- Create: `web/src/components/business/*.tsx`
- Create: `web/src/components/ai/{chat-shell,chat-composer,quick-prompt,tool-progress,result-cards,knowledge-sources}.tsx`
- Create: `web/src/features/navigation/xiaozhi-context.ts`
- Test: component tests and `web/e2e/pages.spec.ts`

**Interfaces:**

```ts
export interface BusinessRepository {
  listHouses(filter: HouseFilter): Promise<Page<House>>;
  getHouse(id: string): Promise<House | null>;
  listDeals(filter: DealFilter): Promise<Page<Deal>>;
  listProducts(filter: ProductFilter): Promise<Page<Product>>;
  getProduct(id: string): Promise<Product | null>;
  listCommunityPosts(filter: PostFilter): Promise<Page<CommunityPost>>;
}
```

`createDemoRepository()` is deterministic and uses the same fixed IDs as SQL seed.

- [ ] **Step 1: Write repository filter tests**

Test 3500/max, one-bedroom and pets returns only matching available houses; out-of-stock filter excludes product 13; sorting is stable by price then id.

- [ ] **Step 2: Implement domain types, demo records, and repository**

Map contracts from root into app types. Include 12 houses, 8 deals, 16 products and 10 posts. All records have `isDemo: true`.

- [ ] **Step 3: Build business and AI presentation components**

Cards receive domain objects and callbacks only. `ResultCards` uses discriminated union and never accepts unvalidated arbitrary JSON. Add Demo badge to each mock card.

- [ ] **Step 4: Assemble all routes**

Follow `docs/04-page-specifications.md` and prototypes. Search and “问问小智” serialize query/context through `xiaozhi-context.ts`; decode and validate on chat page.

- [ ] **Step 5: Implement client-only demo interactions**

Favorites, cart quantity, filters, message tabs and demo checkout use local state with visible “演示流程” notice. No payment form or real order claim.

- [ ] **Step 6: Add page and navigation E2E tests**

Visit every route with seeded IDs, confirm no 404, main heading present, bottom nav appears only where specified, and ask-Xiaozhi carries correct context.

- [ ] **Step 7: Verify and commit**

Run lint, typecheck, unit, E2E page suite and build; commit `feat: implement complete local life product pages`.

---

### Task 4: Supabase migrations, clients, repositories, and data consistency

**Files:**
- Copy/Integrate: root `supabase/migrations/*.sql`
- Create: `web/src/lib/supabase/{browser,server,admin}.ts`
- Create: `web/src/features/business/supabase-repository.ts`
- Create: `web/src/features/business/mappers.ts`
- Create: `web/src/features/memory/repository.ts`
- Create: `web/src/features/conversation/repository.ts`
- Create: `web/src/features/ai-ops/repository.ts`
- Create: `web/src/features/repositories.ts`
- Test: mapper and fake Supabase query tests

**Interfaces:**

```ts
export interface RepositoryMode {
  mode: "supabase" | "demo_fallback";
  reason?: string;
}

export function createRepositories(): {
  business: BusinessRepository;
  memory: MemoryRepository;
  conversations: ConversationRepository;
  aiOps: AIOpsRepository;
  mode: RepositoryMode;
};
```

- [ ] **Step 1: Validate SQL migrations locally or in linked Supabase**

Run `supabase db reset` where Docker/CLI is available. If local Supabase cannot run in the environment, run SQL static checks and apply in a disposable Supabase project before claiming database success. Record actual evidence in the Task report.

- [ ] **Step 2: Write mapper tests before clients**

Test numeric Supabase values convert to numbers, coordinates maintain longitude/latitude order, null arrays become empty arrays, and malformed rows throw `DATA_CONTRACT_INVALID`.

- [ ] **Step 3: Implement three client factories**

Browser client only public keys. Server client uses Next.js cookies. Admin client imports `server-only`, requires service role and is never re-exported from a browser-accessible barrel.

- [ ] **Step 4: Implement Supabase business repository**

Filters map to `.eq`, `.gte`, `.lte`, stable `.order`, and pagination. Product stock joins inventory. No `.select("*")` in list queries; select explicit columns.

- [ ] **Step 5: Implement repository mode and visible fallback**

When demo mode is true, use demo repository. When demo mode is false and config is missing, return unavailable error rather than silently faking Supabase. If a real request fails and fallback is enabled, mark response source as `demo_fallback` and show UI notice.

- [ ] **Step 6: Switch pages to repository-backed reads**

Server pages call application services, not clients directly. Verify the same house ID/price appears on list, detail and later AI result.

- [ ] **Step 7: Verify RLS manually and automatically**

Using anon key, prove public reads work and direct writes to business/knowledge/AI Ops fail. Using authenticated test user, prove own preference reads/writes and cross-user access fails.

- [ ] **Step 8: Verify and commit**

Run gates and commit `feat: connect Supabase domain repositories`.

---

### Task 5: Qwen provider, SSE protocol, and conversation persistence

**Files:**
- Create: `web/src/features/agent/provider.ts`
- Create: `web/src/features/agent/qwen-provider.ts`
- Create: `web/src/features/agent/fake-provider.ts`
- Create: `web/src/features/agent/chat-events.ts`
- Create: `web/src/features/agent/sse.ts`
- Create: `web/src/features/agent/orchestrator.ts`
- Create: `web/src/app/api/chat/route.ts`
- Create: `web/src/components/ai/chat-stream.tsx`
- Create: `web/src/components/ai/use-chat-stream.ts`
- Test: provider fixtures, SSE parser/reducer, route integration

**Interfaces:**

```ts
export interface AIProvider {
  streamTurn(input: ProviderTurnInput, signal: AbortSignal): AsyncIterable<ProviderEvent>;
}

export type ProviderEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_calls"; calls: ProviderToolCall[] }
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "finish"; reason: string };
```

- [ ] **Step 1: Write fake provider and orchestrator contract tests**

Fixtures cover direct text, one tool call, two sequential tool calls, malformed arguments, repeated identical call, provider timeout and abort.

- [ ] **Step 2: Implement Qwen provider**

Use OpenAI-compatible client with server env. Convert Qwen stream chunks into provider-neutral events. Do not leak SDK objects beyond adapter.

- [ ] **Step 3: Implement SSE encoder and client reducer**

Use event names in `contracts/api-contracts.md`. Reducer must append text, update progress by id, add typed cards/citations, and preserve partial output on warning/error.

- [ ] **Step 4: Implement conversation persistence**

Create/reuse session, persist user message before model call, persist assistant text/cards/citations after completion, and save token usage. For anonymous demo, use secure random `anonymous_id` cookie set server-side.

- [ ] **Step 5: Implement initial orchestrator without tools**

It streams direct text, supports abort, maps provider errors, writes request id, and emits done. Tool execution is injected as an interface for Task 6.

- [ ] **Step 6: Verify route and browser behavior**

Test content type, session first event, Unicode streaming, disconnect abort, no key leakage, retry behavior and persistence.

- [ ] **Step 7: Verify and commit**

Commit `feat: add Qwen streaming chat foundation` after full gates.

---

### Task 6: Strict tool registry and business/memory tools

**Files:**
- Create: `web/src/features/agent/tools/{types,schemas,registry,executor}.ts`
- Create: `web/src/features/agent/tools/business-tools.ts`
- Create: `web/src/features/agent/tools/memory-tools.ts`
- Create: `web/src/features/agent/tool-loop.ts`
- Modify: `web/src/features/agent/orchestrator.ts`
- Test: schemas, routing fixtures, loop control, logging

**Interfaces:**

```ts
export interface ToolDefinition<TInput, TOutput> {
  name: ToolName;
  description: string;
  jsonSchema: Record<string, unknown>;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;
}

export interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; retryable: boolean };
  source: "supabase_mock" | "user_memory";
}
```

- [ ] **Step 1: Generate/hand-map strict Zod schemas from tool contracts**

Assert unknown properties fail, numeric bounds hold and UUIDs validate. Keep tool descriptions semantically identical to root contracts.

- [ ] **Step 2: Implement executor with timeout and audit log**

Wrap each tool in an 8-second timeout, write queued/running/succeeded/failed/timed_out records, redact free-text beyond safe summaries, and return stable errors.

- [ ] **Step 3: Implement business tools**

`search_houses`, `get_house_detail`, `search_deals`, `search_products`, `get_product_stock` call repositories and map cards. Exact constraints are applied in database/repository, not by filtering model text.

- [ ] **Step 4: Implement user preference tools**

Read only consented preferences. Save requires `consent_confirmed=true`; reject sensitive or unsupported keys. Current turn filters are merged after preferences so current explicit values win.

- [ ] **Step 5: Implement iterative tool loop**

For each round: request provider → validate calls → dedupe hash(name + canonical args) → execute → append tool messages → continue. At round 8 emit warning and final fallback. Allow one model repair turn for invalid arguments; second invalid call fails that tool.

- [ ] **Step 6: Expose progress and typed result cards**

Public labels never contain SQL. Debug event appears only when request debug is true and public env enables it.

- [ ] **Step 7: Run routing eval subset and commit**

Execute relevant cases from `qa/evaluation-cases.json`; commit `feat: add strict business tool orchestration`.

---

### Task 7: AMap service and location-aware tools

**Files:**
- Create: `web/src/features/maps/{types,service,amap-adapter,fake-adapter,schemas}.ts`
- Create: `web/src/features/agent/tools/maps-tools.ts`
- Create: `web/tests/fixtures/amap/*.json`
- Modify: `web/src/features/agent/tools/registry.ts`
- Modify: `web/src/app/(detail)/nearby/page.tsx`
- Test: adapter fixture tests, timeout/degradation integration

**Interfaces:**

```ts
export interface MapsService {
  geocode(input: GeocodeInput, signal?: AbortSignal): Promise<GeoPoint | null>;
  searchNearby(input: NearbySearchInput, signal?: AbortSignal): Promise<PlaceResult[]>;
  walkingRoute(input: WalkingRouteInput, signal?: AbortSignal): Promise<WalkingRouteResult | null>;
}
```

- [ ] **Step 1: Capture sanitized AMap fixtures**

Add success, empty, invalid key, quota, timeout simulation and malformed response fixtures. Tests must never call live AMap.

- [ ] **Step 2: Write failing coordinate and response tests**

Assert all domain objects use `{longitude, latitude}`, AMap strings serialize `lon,lat`, distances parse as integer meters, and malformed numeric values fail.

- [ ] **Step 3: Implement AMap adapter**

Use server-only fetch, URLSearchParams, API key from env, 8-second timeout and stable errors: `AMAP_UNAUTHORIZED`, `AMAP_QUOTA`, `AMAP_TIMEOUT`, `AMAP_INVALID_RESPONSE`, `AMAP_NO_RESULT`.

- [ ] **Step 4: Implement maps tools and bounded fan-out**

Register `search_nearby_places` and `calculate_walking_route`. For house comparison, limit business candidates to five, nearby checks to three concurrent requests, and route checks to the top three candidates after POI presence.

- [ ] **Step 5: Integrate browser geolocation and named locations**

Ask browser permission only after user action. On denial, use configured 武林广场 center and display explicit fallback notice. Named place is geocoded server-side.

- [ ] **Step 6: Test partial failure**

With AMap timeout fixture, business cards remain, progress marks maps failed, final text says surroundings were not verified, and no place/distance card is emitted.

- [ ] **Step 7: Verify and commit**

Run map tests, multi-tool degradation E2E and full gates; commit `feat: integrate AMap location tools`.

---

### Task 8: Knowledge Service with hybrid RAG, rerank, citations, and indexing

**Files:**
- Create: `web/src/features/knowledge/{types,service,supabase-service,query-planner,chunker,embedding-provider,reranker,citations}.ts`
- Create: `web/src/features/knowledge/qwen-embedding-provider.ts`
- Create: `web/src/features/knowledge/qwen-reranker.ts`
- Create: `web/src/features/agent/tools/knowledge-tools.ts`
- Create: `web/src/app/api/knowledge/search/route.ts`
- Create: `web/src/app/api/knowledge/index/route.ts`
- Create: `web/tests/fixtures/knowledge/*.json`
- Test: retrieval, indexing, citation, low confidence and conflict

**Interfaces:**

```ts
export interface KnowledgeService {
  search(input: KnowledgeSearchInput, signal?: AbortSignal): Promise<KnowledgeSearchResult>;
  indexVersion(versionId: string, signal?: AbortSignal): Promise<IndexResult>;
}

export interface KnowledgeSearchResult {
  chunks: KnowledgeHit[];
  citations: KnowledgeCitation[];
  lowConfidence: boolean;
  conflict: boolean;
  queryPlan: { rewrittenQuery: string; domain?: string; category?: string; city?: string };
}
```

- [ ] **Step 1: Write query planner and filter tests**

Test refund→group_buy/refund, pet→housing/pet, delivery→market/delivery, unknown→no forced domain. Never let the model-proposed metadata bypass the enum whitelist.

- [ ] **Step 2: Implement embedding provider**

Call `text-embedding-v4` with dimensions 1024 through OpenAI-compatible endpoint. Validate exact vector length and finite numbers. Batch indexing with deterministic content hash; skip unchanged ready chunks.

- [ ] **Step 3: Implement chunker**

Normalize Markdown, preserve heading path, target approximately 350–600 Chinese characters per chunk, overlap only one short trailing paragraph, and attach article/version/domain/category/city metadata. Chunks are deterministic for identical content.

- [ ] **Step 4: Implement hybrid retrieval**

Call `hybrid_search_kb` with weights from env, top 12. Reject non-published or expired results again at app boundary. Group adjacent hits, keep diversity and final 5.

- [ ] **Step 5: Add optional reranker**

When enabled, call `qwen3-rerank` with query and candidate content. Validate result indexes and scores. On timeout/invalid response, log warning and use hybrid order.

- [ ] **Step 6: Implement confidence and conflict rules**

Low confidence when top score below threshold or no hits. Conflict when two current-looking hits assert contradictory normalized policy values; return citations but require human verification. Do not let LLM suppress these flags.

- [ ] **Step 7: Register `search_knowledge` and citation UI**

Tool output includes only evidence and flags. System prompt requires citations. UI displays title, version, effective date, excerpt and source marker.

- [ ] **Step 8: Implement idempotent indexing route**

Admin-authenticated route chunks a version, upserts chunks, marks processing/ready/failed, and never publishes by itself. A failed batch can resume without duplicate chunks.

- [ ] **Step 9: Run RAG evaluation subset and commit**

Verify required concepts, citation IDs, low-confidence expired-coupon case and fallback rerank; commit `feat: add enterprise-style RAG knowledge service`.

---

### Task 9: Multi-tool planning, conversation memory, and explainable results

**Files:**
- Create: `web/src/features/agent/context-builder.ts`
- Create: `web/src/features/agent/result-synthesizer.ts`
- Create: `web/src/features/conversation/summarizer.ts`
- Create: `web/src/features/memory/merge-preferences.ts`
- Modify: chat UI and orchestrator
- Test: multi-turn, preference precedence, multi-tool scenarios

**Interfaces:**

```ts
export function mergePreferences<T extends Record<string, unknown>>(
  longTerm: T,
  currentTurn: Partial<T>,
): T;

export interface ContextWindow {
  systemPrompt: string;
  conversationSummary?: string;
  recentMessages: ProviderMessage[];
  pageContext?: ValidatedPageContext;
}
```

- [ ] **Step 1: Test current-turn precedence and consent**

Long-term budget 3500 plus current “4000以内” produces 4000 for this turn without overwriting saved preference. A one-off “今天吃清淡” does not save memory.

- [ ] **Step 2: Implement bounded context builder**

Use system prompt + conversation summary + recent 12 messages + validated page context. Never inject raw community content as instructions; wrap as untrusted user-provided context.

- [ ] **Step 3: Implement deterministic result synthesis inputs**

Agent final turn receives normalized tool summaries, not raw database rows or entire AMap payload. Preserve IDs so UI cards are loaded from validated tool result.

- [ ] **Step 4: Add conversation summarization**

When message count exceeds threshold, generate or deterministically build a summary of user constraints and unresolved questions; exclude secrets and tool payloads. Keep recent messages untouched.

- [ ] **Step 5: Test main multi-tool scenario**

Assert tool order dependency, candidate count bound, cards, map source, pet citation, and no exact walking time when route is absent.

- [ ] **Step 6: Improve explainability UI**

Public progress: understand → business → nearby → knowledge → recommendation. Debug panel includes tool name, sanitized args, source, count, duration and error code; no hidden reasoning text.

- [ ] **Step 7: Verify and commit**

Run all evaluation categories through fake services and E2E main demo; commit `feat: support explainable multi-tool conversations`.

---

### Task 10: Knowledge candidates, human review, publishing, and evaluation loop

**Files:**
- Create: `web/src/features/knowledge-ops/{service,repository,schemas}.ts`
- Create: `web/src/app/knowledge-admin/page.tsx`
- Create: `web/src/app/knowledge-admin/[id]/page.tsx`
- Create: `web/src/app/api/feedback/route.ts`
- Create: `web/src/app/api/knowledge/{candidates,publish,evaluate}/route.ts`
- Create: `web/src/features/evaluation/{runner,metrics}.ts`
- Test: candidate triggers, review authorization, publish/index/eval sequence

**Interfaces:**

```ts
export interface KnowledgeOpsService {
  createCandidate(input: CandidateInput): Promise<string>;
  draftCandidate(candidateId: string): Promise<CandidateDraft>;
  review(input: ReviewInput): Promise<ReviewResult>;
  publish(input: PublishInput): Promise<PublishResult>;
}
```

- [ ] **Step 1: Write candidate trigger tests**

Low confidence, no result and explicit downvote create one deduplicated candidate; upvote does not. Store normalized question and evidence IDs, not a raw unrestricted conversation dump.

- [ ] **Step 2: Implement feedback API and UI**

Validate message ownership or anonymous session cookie. Record rating. For downvote reasons missing source/outdated/incorrect, enqueue candidate with stable reason.

- [ ] **Step 3: Implement protected knowledge operations pages**

Use `DEMO_ADMIN_TOKEN` for portfolio demo access and server-side guard. List queue, candidate details, evidence, editable draft, decision history and index/eval state. Never expose token in query string or client JavaScript.

- [ ] **Step 4: Implement draft and review workflow**

AI may propose title/answer/change summary using evidence, but draft stays candidate state. Approve requires source reference, owner, domain/category and effective date. Reject requires notes.

- [ ] **Step 5: Implement transactional publication sequence**

Create new version → review row → call `publish_kb_version` → run `indexVersion` → run selected eval cases. If indexing fails, surface state and prevent the UI from claiming searchable success. If eval fails, keep published state visible with a risk warning and allow rollback to previous version.

- [ ] **Step 6: Implement evaluation runner**

Read `ai_eval_cases`, execute with fake or selected real services, calculate routing, citation, concept, refusal and degradation checks, save run configuration and outputs.

- [ ] **Step 7: E2E knowledge evolution demo**

First expired-coupon question creates gap; admin adds approved rule; index runs; second paraphrase returns new citation. Also test rejected candidate never appears in search.

- [ ] **Step 8: Verify and commit**

Commit `feat: add governed knowledge evolution loop` after full gates.

---

### Task 11: Security, observability, resilience, and performance

**Files:**
- Create: `web/src/lib/{logger,redaction,request-id,timeout,rate-limit}.ts`
- Create: `web/src/features/observability/metrics.ts`
- Modify: all API routes and external adapters
- Create: security and degradation tests

**Interfaces:**

```ts
export interface LogContext {
  requestId: string;
  sessionId?: string;
  toolName?: string;
  durationMs?: number;
  errorCode?: string;
  resultCount?: number;
}
```

- [ ] **Step 1: Write redaction tests**

Redact values under keys matching key/token/authorization/cookie/password/service_role, phone-like strings and precise user address fields. Preserve request id and aggregate metrics.

- [ ] **Step 2: Add request IDs and structured logs**

Every API response includes request id; every provider/tool/retrieval log shares it. Use JSON logs in production and readable logs in development.

- [ ] **Step 3: Add rate limits and payload limits**

Limit chat per anonymous id/user and IP hash, feedback, admin publish and indexing. Reject >4,000-character chat messages and oversized JSON before model calls. Return 429 with retryable guidance.

- [ ] **Step 4: Add timeouts, retry policy, and circuit behavior**

Qwen 30s overall, individual tools 8s. Retry only idempotent transient requests once with jitter; do not retry auth/quota/validation errors. Temporarily short-circuit repeatedly failing external service and report unavailable.

- [ ] **Step 5: Test prompt injection and data isolation**

Knowledge content attempting to override system rules remains quoted evidence. Cross-user session, preference and feedback access fails. Debug panel cannot expose raw keys or hidden prompt.

- [ ] **Step 6: Measure performance budgets**

Use Lighthouse/Playwright traces for main pages; tool and model timings from logs. Lazy-load heavy chat/debug and images. Ensure initial business pages do not bundle server SDKs.

- [ ] **Step 7: Verify and commit**

Run security, degradation, bundle/build and full tests; commit `feat: harden AI service operations`.

---

### Task 12: Final E2E, Vercel deployment, documentation, and interview release

**Files:**
- Create/Modify: `web/e2e/main-demo.spec.ts`
- Create/Modify: `web/README.md`
- Create: `web/docs/deployment.md`
- Create: `web/docs/runbook.md`
- Modify: root `README.md` with final links and verified status only after evidence

**Interfaces:**
- Production deployment exposes `/api/health` and all product routes.
- Runbook gives exact fallback switches and recovery checks.

- [ ] **Step 1: Implement final Playwright suite**

Cover all scenarios in `qa/demo-script.md`, 360/390/430 viewports, keyboard navigation, source badges, no overflow, error recovery and knowledge evolution. Use deterministic fixture mode for CI and a tagged staging smoke suite for live services.

- [ ] **Step 2: Run complete quality gate**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Record exact counts and failures. A command that did not run is not reported as passing.

- [ ] **Step 3: Configure Vercel**

Import repository, set Root Directory `web/`, set Node 22 and environment variables for Preview/Production. Apply Supabase migrations and generate embeddings before live RAG smoke test.

- [ ] **Step 4: Run production smoke checks**

Check homepage, each main route, health status, business query, RAG citation, AMap POI, multi-tool degradation and feedback candidate. Confirm browser source contains no server keys.

- [ ] **Step 5: Prepare interview assets**

Generate QR code for production URL, record a short backup video, preserve a known demo session, and document limitations: mock commerce, public prototype load, external API quotas and current single-region design.

- [ ] **Step 6: Final requirement review**

Map every item in `docs/11-acceptance-criteria.md` to test evidence or a clearly reported gap. Do not mark incomplete work as complete.

- [ ] **Step 7: Commit release**

```bash
git add .
git commit -m "release: prepare xiaozhi interview portfolio"
git tag xiaozhi-interview-v1
```

Only tag after all required quality gates and production smoke checks pass.
