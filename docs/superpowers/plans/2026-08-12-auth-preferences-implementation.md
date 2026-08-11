# 小智 Auth 与长期偏好 Implementation Plan

> **后续决策：** CAPTCHA 与公开注册相关步骤已由 `2026-08-12-interview-otp-simplification-implementation.md` 取代；其余会话、Preferences 与 RLS 任务仍有效。

**Goal:** 在不阻断公开业务浏览的前提下，交付可验证的邮箱 6 位 OTP 登录、Supabase 会话刷新、按 `auth.uid()` 隔离的云端长期偏好，以及“模型提案、用户确认、API 写入”的真实授权链路。

**Architecture:** Next.js Route Handler 负责请求边界、Supabase Auth 和会话 Cookie；Preferences application service 负责授权时间、部分更新和撤销语义；Memory Repository 只封装用户会话下的数据访问；RLS 是独立的第二道权限边界。Agent 保持只读偏好工具，并以无副作用提案工具生成确认卡，真正写入仅由用户界面调用 `/api/preferences`。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript strict、Zod 4、`@supabase/ssr`、`@supabase/supabase-js`、Supabase Auth/PostgreSQL/RLS、Tailwind CSS 4、Vitest、Testing Library、Playwright、pnpm。

## Global Constraints

- 设计依据：`docs/superpowers/specs/2026-08-12-auth-preferences-design.md`。
- 公开业务页面继续允许游客浏览；个人偏好页面和写操作必须登录。
- API 只使用 `auth.getUser()` 的用户 ID，不接受客户端 `userId`。
- 偏好 API 使用用户会话 client，不使用 service role 绕过 RLS。
- 授权时间只由服务端生成；客户端和模型均不能提交授权时间。
- `propose_user_preference` 无数据库副作用；取消或忽略提案必须零写入。
- 关闭长期记忆删除 `user_preferences` 整行，不能只把开关设为 false 后残留数据。
- Live 失败不回退到 localStorage 或 Demo 用户并声称云端保存成功。
- 请求体使用 strict Zod、大小上限、稳定错误、请求 ID 和 `cache-control: no-store`。
- 状态变更 API 校验同源请求；公开上线前还需要 CAPTCHA、共享限流和自定义 SMTP。
- 每个 Task 先写或更新测试并看到预期失败，再实现最小完整行为。
- 使用 Conventional Commits；普通功能提交不创建 Git tag。

---

## Task 1: Model tool contract becomes proposal-only

**Files:**

- Modify: `contracts/tool-contracts.json`
- Modify: `contracts/api-contracts.md`
- Modify: `qa/evaluation-cases.json`
- Modify: `web/src/features/agent/tools/schemas.ts`
- Modify: `web/src/features/agent/tools/memory-tools.ts`
- Modify: `web/src/features/agent/demo-tool-provider.ts`
- Modify: `web/src/features/agent/tools/__tests__/schemas.test.ts`
- Modify: `web/src/features/agent/tools/__tests__/memory-tools.test.ts`
- Modify: `web/src/features/agent/__tests__/demo-tool-provider.test.ts`

**Produces:**

- `propose_user_preference` replaces `save_user_preference` in all current runtime contracts.
- Proposal input contains only `key` and `value`; no `consent_confirmed`.
- Successful proposal returns normalized proposal data, but never calls `MemoryRepository`. The typed confirmation card is added in Task 6 after the Preferences API exists.

**Steps:**

1. Update schema and memory-tool tests to require `propose_user_preference`, reject `consent_confirmed`, assert zero Repository writes, and expect normalized proposal data.
2. Run focused tests and verify RED because the old write tool still exists.
3. Change the canonical JSON contract and TypeScript mirror together; bump contract version to `1.1.0`.
4. Replace the tool implementation with value validation plus a side-effect-free result.
5. Update deterministic demo routing and evaluation expectations to the new tool name.
6. Run contract, memory-tool and demo-provider tests.
7. Commit: `refactor(agent): require user confirmation for preferences`.

---

## Task 2: Shared Auth request contracts and session refresh

**Files:**

- Create: `web/src/features/auth/schemas.ts`
- Create: `web/src/features/auth/safe-next.ts`
- Create: `web/src/features/auth/same-origin.ts`
- Create tests under: `web/src/features/auth/__tests__/`
- Create: `web/src/lib/supabase/update-session.ts`
- Create: `web/src/proxy.ts`
- Modify: `web/src/lib/env.ts`
- Modify: `web/src/lib/__tests__/env.test.ts`

**Produces:**

- Strict `otpSendSchema` and `otpVerifySchema`.
- `safeNextPath(value, fallback)` that accepts only safe internal paths.
- `assertSameOrigin(request)` for state-changing routes.
- Next.js 16 `proxy.ts` that refreshes Supabase Auth cookies while excluding static assets.

**Steps:**

1. Write failing tests for valid/invalid email, six-digit OTP, unknown fields and `next` attacks including absolute URLs, `//`, backslashes and control characters.
2. Write failing same-origin tests for matching, absent local-test, mismatched and malformed origins.
3. Implement the strict schemas and helpers without embedding provider logic.
4. Add `updateSession()` using the publishable key and cookie `getAll`/`setAll`; use `auth.getUser()` to validate/refresh the session.
5. Add `src/proxy.ts` with a matcher that excludes `_next/static`, `_next/image`, favicon and common public assets.
6. Add explicit server configuration for whether CAPTCHA is required; no public secret enters `NEXT_PUBLIC_*`.
7. Run focused tests, lint and typecheck.
8. Commit: `feat(auth): add secure session request boundaries`.

---

## Task 3: OTP Auth API

**Files:**

- Create: `web/src/features/auth/runtime.ts`
- Create: `web/src/features/auth/error-map.ts`
- Create: `web/src/app/api/auth/otp/send/route.ts`
- Create: `web/src/app/api/auth/otp/send/route.test.ts`
- Create: `web/src/app/api/auth/otp/verify/route.ts`
- Create: `web/src/app/api/auth/otp/verify/route.test.ts`
- Create: `web/src/app/api/auth/sign-out/route.ts`
- Create: `web/src/app/api/auth/sign-out/route.test.ts`
- Create or reuse: `web/src/lib/api-error-response.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/templates/magic-link.html`

**Produces:**

- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `POST /api/auth/sign-out`
- Stable public errors with request ID and no provider detail leakage.
- Local Supabase email template that renders `{{ .Token }}`.

**Steps:**

1. Write injectable handler tests for success, invalid body, body too large, same-origin failure, rate limit, provider failure and safe response headers.
2. Verify RED because the routes do not exist.
3. Implement send with `signInWithOtp({ email, options: { shouldCreateUser: true, captchaToken } })` and indistinguishable success messaging.
4. Implement verify with `verifyOtp({ email, token, type: "email" })`; return only the sanitized internal `next`.
5. Implement sign-out for the current session; make repeated sign-out safe.
6. Normalize provider failures into `AUTH_EMAIL_INVALID`, `AUTH_OTP_INVALID`, `AUTH_RATE_LIMITED`, `AUTH_OTP_SEND_FAILED` or `AUTH_UNAVAILABLE`.
7. Configure local email capture template for a six-digit code; do not add SMTP credentials.
8. Run the three route suites, lint and typecheck.
9. Commit: `feat(auth): add email otp session api`.

---

## Task 4: Preferences schemas, service, Repository and API

**Files:**

- Create: `web/src/features/preferences/schemas.ts`
- Create: `web/src/features/preferences/service.ts`
- Create tests under: `web/src/features/preferences/__tests__/`
- Modify: `web/src/features/memory/repository.ts`
- Modify: `web/src/features/memory/__tests__/repository.test.ts`
- Create: `web/src/app/api/preferences/route.ts`
- Create: `web/src/app/api/preferences/route.test.ts`
- Modify: `contracts/api-contracts.md`

**Produces:**

- Strict discriminated PATCH contract for enable/update versus disable/delete.
- Server-generated authorization time on first enable or re-enable.
- Partial update semantics: omitted retains, empty list clears, null budget clears.
- `MemoryRepository.deletePreferences(userId)`.
- Authenticated `GET/PATCH /api/preferences` using a user-session client.

**Steps:**

1. Write failing schema tests for valid partial updates, unknown `userId`, client `consentedAt`, duplicate list normalization, limits and invalid disable payloads.
2. Update Repository tests to require explicit internal consent time, partial upsert and delete behavior.
3. Write service tests with an injected clock: first enable creates authorization time; later edits preserve it; disable deletes; repeated disable remains idempotent.
4. Write route tests: `auth.getUser()` required, client identity rejected, no service role, correct error codes and no-store/request ID headers.
5. Implement schemas, service and Repository changes.
6. Implement GET/PATCH handler factories so Auth and Repository can be tested without network access.
7. Run schema, service, Repository and API suites.
8. Update the acceptance/API contract wording from fixed demo profile to authenticated Live behavior.
9. Commit: `feat(preferences): persist consented user memory`.

---

## Task 5: Login and cloud preference UI

**Files:**

- Create: `web/src/components/auth/login-experience.tsx`
- Create: `web/src/components/auth/__tests__/login-experience.test.tsx`
- Create: `web/src/app/login/page.tsx`
- Create: `web/src/components/account/preferences-experience.tsx`
- Create: `web/src/components/account/__tests__/preferences-experience.test.tsx`
- Modify: `web/src/app/me/preferences/page.tsx`
- Modify: `web/src/components/account/account-experiences.tsx`
- Modify: `web/src/components/pages/account-utility-actions.tsx`
- Modify related account tests

**Produces:**

- Two-stage email/OTP login page with resend, error recovery and safe `next`.
- Server-side redirect from `/me/preferences` when no authenticated user exists.
- Real GET/PATCH preference UI with confirmation dialog, Toast, loading/error/empty states and revoke/delete action.
- Visible sign-out action.

**Steps:**

1. Write failing component tests for email-to-OTP transition, pasteable code, safe redirect, resend countdown, API error preservation and accessibility status.
2. Replace the old test that expects no persistence with tests that mock the real API and verify the confirmation boundary.
3. Implement `/login` using existing 430px `DetailShell`/navigation tokens; do not call Supabase directly from UI.
4. Protect `/me/preferences` on the server and render a client experience that fetches current cloud state.
5. Require `ConfirmDialog` before enable/update and before destructive disable/delete.
6. Preserve form values on failure; show success only after a successful API response.
7. Add sign-out without equating it to preference deletion.
8. Run component tests, lint and typecheck.
9. Commit: `feat(account): add otp login and cloud preferences`.

---

## Task 6: Preference proposal confirmation in chat

**Files:**

- Modify: `web/src/features/agent/chat-events.ts`
- Modify: `web/src/features/agent/tools/memory-tools.ts`
- Modify: `web/src/features/agent/tools/__tests__/memory-tools.test.ts`
- Modify: `web/src/components/chat/agent-result-cards.tsx`
- Modify: `web/src/components/chat/__tests__/agent-result-cards.test.tsx`
- Modify: `web/src/components/chat/chat-experience.tsx` only if shared Toast state is required
- Modify related SSE/result-synthesizer tests

**Produces:**

- Typed `preference_proposal` result card.
- Exact key/value preview, “确认保存”和“取消” actions.
- Confirm action calls `/api/preferences`; cancel performs no request.
- Anonymous confirm redirects to `/login` with a safe return path.

**Steps:**

1. Write failing protocol and UI tests for valid proposal, malformed data rejection, cancel zero-write, confirm PATCH and API failure preservation.
2. Extend the closed `ResultCard` kind, attach it to the proposal tool result, and validate proposal data with a dedicated Zod schema.
3. Render a compact confirmation card using existing Button, Toast and accessible status patterns.
4. Map one proposal key into a partial Preferences PATCH payload; never pass `userId` or `consentedAt`.
5. Ensure result synthesis does not treat the proposal as an already-saved fact.
6. Run chat-event, result-card, tool-loop and full agent tests.
7. Commit: `feat(chat): confirm preference proposals before save`.

---

## Task 7: Local Supabase Auth, RLS and browser verification

**Files:**

- Modify: `web/scripts/verify-rls.mjs`
- Modify: `web/scripts/verify-postgrest-rls.mjs`
- Create: `web/scripts/verify-auth-preferences.mjs`
- Create: `web/e2e/auth-preferences.spec.ts`
- Modify: `web/playwright.config.ts` only for an explicit Auth test project/environment
- Modify: `docs/11-acceptance-criteria.md`
- Create: `docs/task-reports/2026-08-12-auth-preferences.md`

**Produces:**

- Database-role and PostgREST evidence for own-row read/write/delete and cross-user denial.
- Local Mailpit OTP login evidence.
- Browser evidence for login, persistence after refresh, sign-out, proposal confirm and revoke/delete.

**Steps:**

1. Start/reset local Supabase and verify all migrations apply.
2. Extend RLS scripts to prove user A can delete own row, user B cannot read/update/delete it, and anon cannot access preferences.
3. Implement a local verification script that requests OTP, reads the captured Mailpit message through its local API, extracts the six-digit token, verifies it, and exercises Preferences API without logging secrets.
4. Add a dedicated Playwright flow against local Supabase; keep the existing Demo E2E project deterministic.
5. Run RLS SQL, PostgREST HTTP, Auth script and browser tests.
6. Record exact evidence and leave online Production-only checks unchecked.
7. Commit: `test(auth): verify otp preferences and rls`.

---

## Task 8: Full regression, security audit and branch delivery

**Files:**

- Modify only evidence-driven failures from Tasks 1–7
- Update: `docs/task-reports/2026-08-12-auth-preferences.md`

**Steps:**

1. Run formatting only on changed files and inspect the diff for unrelated rewrites.
2. Run all required gates:

```powershell
cd web
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

3. Run `pnpm db:verify-rls`, `pnpm db:verify-http` and the new Auth verification while local Supabase is running.
4. Scan source, static bundles and Git history diff for server key names, token values, OTPs, full emails and preference payload logging.
5. Verify Production mode does not fall back to Demo/localStorage on Auth or preference failure.
6. Verify worktree cleanliness and every new commit subject against Conventional Commits.
7. Push `codex/housing-http-adapter` only after all local evidence is green.

## User actions required later

The implementation and local verification can proceed without user action. Before public Production OTP is declared complete, pause and guide the user through exactly these external steps:

1. Choose or connect the production domain.
2. Configure a custom SMTP provider and verify its sender domain.
3. Configure the Supabase email template to display `{{ .Token }}`.
4. Enable CAPTCHA and provide the public site key/server secret through platform environment settings.
5. Configure shared rate limiting for Vercel multi-instance deployment.
6. Complete one real-email smoke test without pasting the OTP or session token into chat.

Until those checks exist, the honest status is“代码与本地 Auth 链路完成，公开 Production 邮件链路未验收”。
