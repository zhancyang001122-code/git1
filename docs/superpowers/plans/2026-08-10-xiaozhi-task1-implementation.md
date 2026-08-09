# Xiaozhi Task 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the complete Xiaozhi specification kit into the canonical Git repository and build only the tested Next.js engineering foundation defined by Task 1.

**Architecture:** The repository root holds product specifications, contracts, prototypes, migrations, QA assets, and project rules. The actual Next.js App Router application lives only in `web/`, with explicit client/server environment boundaries and a non-networking health endpoint.

**Tech Stack:** Node.js 24.18.0, pnpm 10.14.0, current stable Next.js created by the official `create-next-app`, TypeScript strict, Tailwind CSS, ESLint, Prettier, Vitest, Testing Library, Playwright, Zod.

## Global Constraints

- Source kit is read-only: `C:\Users\Administrator\Downloads\xiaozhi-local-life-codex-kit\xiaozhi-local-life-codex-kit`.
- Canonical repository is `C:\Users\Administrator\Desktop\git1`.
- Preserve existing Git history and both existing 2026-08-10 design documents.
- Never overwrite a conflicting file without comparing content.
- Create application code only in `web/`.
- Execute only existing implementation-plan Task 1 and stop before Task 2.
- Do not connect Supabase, Qwen, AMap, RAG, or housing in this task.
- Do not create real secrets. Demo mode must build without external keys.
- All new commits follow Conventional Commits; no tag and no push in this task.
- Required final commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Explain each completed batch to the user in plain Chinese; the engineering plan itself is not required reading for the user.

---

### Task 1: Import the Specification Kit Without Overwriting Existing Work

**Files:**
- Copy: source `AGENTS.md`, `MANIFEST.md`, `codex/`, `config/`, `contracts/`, `design/`, `docs/`, `qa/`, `scripts/`, `supabase/`
- Modify: `README.md`
- Preserve: `docs/superpowers/specs/2026-08-10-housing-api-design.md`
- Preserve: `docs/superpowers/specs/2026-08-10-xiaozhi-task1-start-design.md`
- Preserve: `docs/superpowers/specs/2026-08-09-git-commit-release-conventions-design.md`

**Interfaces:**
- Consumes: immutable specification kit.
- Produces: one self-contained canonical repository with no application code yet.

- [ ] **Step 1: Record source and target state**

Run:

```powershell
git status --short --branch
git log -5 --oneline
rg --files 'C:\Users\Administrator\Downloads\xiaozhi-local-life-codex-kit\xiaozhi-local-life-codex-kit'
rg --files 'C:\Users\Administrator\Desktop\git1'
```

Expected: Git working tree is clean; source includes the kit; target includes the existing design files.

- [ ] **Step 2: Detect conflicts before copying**

For every source file, resolve the relative path under the target. If the target exists, compare SHA-256. Produce three lists: new files, identical files, different files. The copy operation may continue only for new and identical files; different files require an explicit merge.

Expected known conflict: root `README.md`. Merge it instead of copying over it.

- [ ] **Step 3: Copy only non-conflicting specification assets**

Use a single PowerShell copy loop that creates missing parent directories and copies only absent files. Do not copy `.git`, caches, bytecode, environment files, or a `web/` directory.

- [ ] **Step 4: Merge the root README**

The final README must state that the repository contains the Xiaozhi specification kit, that application code will live in `web/`, and link to the startup design, housing design, and commit convention design. It must not claim the application already exists.

- [ ] **Step 5: Verify source integrity and target completeness**

Run source/target hash comparisons for every copied file and verify the three preserved design files still match their pre-copy hashes.

- [ ] **Step 6: Commit the specification import**

```powershell
git diff --check
git add AGENTS.md MANIFEST.md codex config contracts design docs qa scripts supabase README.md
git commit -m "chore(xiaozhi): import project specification kit"
```

Expected: a specification-only commit; no `web/` files.

---

### Task 2: Scaffold the Next.js Application

**Files:**
- Create: `web/` via official `create-next-app`
- Create: `web/pnpm-lock.yaml`
- Modify: `web/package.json`
- Modify: `web/tsconfig.json`
- Copy: `config/.env.example` to `web/.env.example`

**Interfaces:**
- Consumes: root specification and Node/pnpm toolchain.
- Produces: an isolated Next.js App Router application with pinned pnpm version and quality scripts.

- [ ] **Step 1: Verify current CLI flags**

Run:

```powershell
pnpm dlx create-next-app@latest --help
```

Confirm support for TypeScript, Tailwind, ESLint, App Router, `src/`, Turbopack, alias, pnpm, non-interactive mode, and disabling nested Git initialization. Adapt only flag spelling if the official CLI changed; do not alter the selected architecture.

- [ ] **Step 2: Create `web/`**

Run the supported equivalent of:

```powershell
pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --turbopack --import-alias '@/*' --use-pnpm --yes
```

If the CLI creates `web/.git`, remove only that verified nested `.git` directory so the root repository remains canonical.

- [ ] **Step 3: Add Task 1 dependencies**

From `web/` run:

```powershell
pnpm add @supabase/ssr @supabase/supabase-js openai zod lucide-react clsx tailwind-merge react-markdown remark-gfm
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test prettier prettier-plugin-tailwindcss
```

- [ ] **Step 4: Add exact quality scripts and compiler options**

Keep `dev`, `build`, `start`, and `lint`; add:

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

Set `strict: true` and `noUncheckedIndexedAccess: true`. Pin the actual pnpm version in `packageManager`.

- [ ] **Step 5: Copy only the safe environment template**

Copy `config/.env.example` to `web/.env.example`. Confirm it contains names and safe examples only, not real credentials.

---

### Task 3: Implement the Environment Contract With TDD

**Files:**
- Create: `web/src/lib/env.ts`
- Create: `web/src/lib/errors.ts`
- Create: `web/src/lib/__tests__/env.test.ts`
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`

**Interfaces:**
- Produces: `parsePublicEnv()`, `parseServerEnv()`, lazy `publicEnv()`, lazy `serverEnv()`, `getServiceConfiguration()`, `AppError`, and `toPublicError()`.

- [ ] **Step 1: Configure Vitest**

Use jsdom, `@/*` alias, and setup importing `@testing-library/jest-dom/vitest`.

- [ ] **Step 2: Write failing environment tests**

Tests must prove:

```typescript
it("allows explicit demo mode without external keys", () => {
  const value = parsePublicEnv({ NEXT_PUBLIC_DEMO_MODE: "true" });
  expect(value.NEXT_PUBLIC_DEMO_MODE).toBe(true);
});

it("rejects malformed public URLs", () => {
  expect(() =>
    parsePublicEnv({
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    }),
  ).toThrow();
});

it("does not expose server secrets through the public parser", () => {
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
```

- [ ] **Step 3: Run the focused test and confirm failure**

```powershell
pnpm test src/lib/__tests__/env.test.ts
```

Expected: FAIL because `env.ts` is not implemented.

- [ ] **Step 4: Implement minimal Zod parsing**

Convert string booleans, validate URLs, keep client and server shapes separate, and use lazy getters so an explicit demo build does not require external keys. Never include server keys in the public return value.

- [ ] **Step 5: Implement stable public errors**

Use:

```typescript
export interface PublicError {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}
```

`toPublicError()` must not serialize `cause`, stack traces, or secret-bearing input.

- [ ] **Step 6: Run focused and complete unit tests**

```powershell
pnpm test src/lib/__tests__/env.test.ts
pnpm test
```

Expected: PASS.

---

### Task 4: Add the Non-Networking Health Endpoint With TDD

**Files:**
- Create: `web/src/app/api/health/route.ts`
- Create: `web/src/app/api/health/route.test.ts`

**Interfaces:**
- Produces: `GET /api/health` returning `{ app, mode, services: { supabase, qwen, amap } }`.

- [ ] **Step 1: Write failing route tests**

Tests must prove status 200, allowed status values (`configured`, `missing`, `disabled`), demo-mode reporting, and absence of provided secret values in the serialized body.

- [ ] **Step 2: Run the route test and confirm failure**

```powershell
pnpm test src/app/api/health/route.test.ts
```

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement the route**

Read configuration state only. Do not call Supabase, Qwen, AMap, housing, or any network endpoint. Return no environment variable values.

- [ ] **Step 4: Run route and complete tests**

```powershell
pnpm test src/app/api/health/route.test.ts
pnpm test
```

Expected: PASS.

---

### Task 5: Add Smoke Coverage and Verify the Production Build

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/src/app/__tests__/smoke.test.tsx`
- Create: `web/e2e/smoke.spec.ts`
- Modify: generated home page only enough to give it a stable Chinese title and heading.

**Interfaces:**
- Produces: component smoke test, Playwright browser smoke test configuration, and stable home-page identity.

- [ ] **Step 1: Write the failing component smoke test**

Render the home page and expect a visible heading containing `小智`.

- [ ] **Step 2: Run it and confirm failure if generated copy lacks the heading**

```powershell
pnpm test src/app/__tests__/smoke.test.tsx
```

- [ ] **Step 3: Make the smallest page change**

Use a simple semantic `<main>` and `<h1>小智本地生活 AI 服务助手</h1>`. Do not start the visual design system or Task 2 components.

- [ ] **Step 4: Configure Playwright**

Use `pnpm dev` on port 3000 and verify `/` contains the stable heading. Install the required Chromium runtime only if it is absent.

- [ ] **Step 5: Run every required quality gate**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm test:e2e` when Chromium is available. If browser installation is blocked, report E2E as configured but not executed; do not report PASS.

- [ ] **Step 6: Check secrets and scope**

Search tracked files and build output for known placeholder secret values and server-only variable names in client bundles. Confirm no real `.env` file is tracked and no Task 2 files were created.

- [ ] **Step 7: Commit Task 1**

```powershell
git diff --check
git add web
git commit -m "chore(web): scaffold xiaozhi application"
```

- [ ] **Step 8: Stop and report evidence**

Report changed areas, exact verification results, demo/real/unavailable state, known gaps reserved for later tasks, final commit hash, and clean working-tree status. Do not begin Task 2.

