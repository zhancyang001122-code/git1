# Xiaozhi Task 2.5 Design System and Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable 430px Xiaozhi mobile design system and use it to deliver one visually complete, responsive, accessible, and honestly demo-labelled home page.

**Architecture:** The home route remains a React Server Component that assembles a tokenized `MobileCanvas`, `AppShell`, presentational home sections, and typed deterministic demo records. Browser state is isolated to small search and unavailable-feature client components; no API, database, map, model, housing service, or network adapter is introduced.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Lucide React, `clsx`, `tailwind-merge`, Vitest, Testing Library, Playwright, Next Image, imagegen skill.

## Global Constraints

- Canonical repository: `C:\Users\Administrator\Desktop\git1`.
- Execute in an isolated worktree created by `superpowers:using-git-worktrees`.
- Source design: `docs/superpowers/specs/2026-08-10-xiaozhi-task2-home-design.md`.
- Visual reference only: `design/prototypes/01-home.png`; never render or crop the prototype into product UI.
- App code stays under `web/`; Vercel Root Directory remains `web/`.
- Canvas width is 360–430px fluid and 430px maximum above that range.
- Main content bottom padding is at least 104px.
- Bottom navigation is 76px plus safe area; central Xiaozhi control is 64px and raised 14px.
- Every interactive target is at least 44×44px with visible keyboard focus.
- UI components consume token classes; no page-specific arbitrary color system.
- No Supabase, housing API, Qwen, AMap, RAG, payment, order, booking, or external application call.
- Home search and business entry clicks show honest unavailable feedback and never fake success.
- Housing content is labelled `2024 历史房源示例`; it never claims current availability.
- Group-buy, market, and community content is visibly labelled as demo/mock content.
- Image generation produces local content assets only; controls and readable copy remain HTML.
- Use Conventional Commits. Do not tag or push unless separately requested.
- Required final gates: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

---

### Task 1: Tokenized Mobile Shell and Single Bottom Navigation

**Files:**
- Modify: `web/src/app/globals.css`
- Create: `web/src/lib/cn.ts`
- Create: `web/src/components/layout/mobile-canvas.tsx`
- Create: `web/src/components/layout/page-header.tsx`
- Create: `web/src/components/layout/bottom-navigation.tsx`
- Create: `web/src/components/layout/app-shell.tsx`
- Create: `web/src/components/layout/__tests__/bottom-navigation.test.tsx`
- Create: `web/e2e/mobile-shell.spec.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`.
- Produces: `type MainNavKey = "home" | "discover" | "xiaozhi" | "messages" | "me"`.
- Produces: `BottomNavigation({ active }: { active: MainNavKey })`.
- Produces: `AppShell({ children, activeNav, header?, hideBottomNav? })`.
- Produces: `MobileCanvas({ children, className? })`.

- [ ] **Step 1: Write failing navigation contract tests**

Create `bottom-navigation.test.tsx` with real rendering assertions:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import { BottomNavigation } from "@/components/layout/bottom-navigation";

describe("BottomNavigation", () => {
  it("renders the five fixed product destinations", () => {
    render(<BottomNavigation active="home" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/discover",
      "/xiaozhi",
      "/messages",
      "/me",
    ]);
    expect(screen.getByRole("link", { name: "小智" })).toBeInTheDocument();
  });

  it("marks only the active destination as current", () => {
    render(<BottomNavigation active="messages" />);

    expect(screen.getByRole("link", { name: "消息" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page"),
    ).toHaveLength(1);
  });

  it("lets AppShell own the only navigation landmark", () => {
    render(
      <AppShell activeNav="home">
        <h1>首页</h1>
      </AppShell>,
    );

    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveClass("pb-[104px]");
  });
});
```

- [ ] **Step 2: Write the failing responsive shell browser test**

Create `web/e2e/mobile-shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

for (const width of [360, 390, 430]) {
  test(`mobile shell fits ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.viewportWidth);
  });
}
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
cd web
pnpm test src/components/layout/__tests__/bottom-navigation.test.tsx
pnpm test:e2e --grep "mobile shell"
```

Expected: unit suite fails because layout modules do not exist; E2E fails because the current home page has no `主导航` landmark.

- [ ] **Step 4: Implement tokens, utility, and layout shell**

Implement `cn.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Copy the values from `config/tailwind-theme.css` into `globals.css` as semantic CSS variables and Tailwind theme tokens. Keep one canvas wrapper only.

Implement the fixed navigation data inside `bottom-navigation.tsx` using `House`, `Compass`, `Bot`, `MessageCircle`, and `UserRound` from Lucide. Use a semantic `<nav aria-label="主导航">`, exactly five `Link` children, `aria-current="page"` only on the active item, and a 64px central Xiaozhi visual inside a link whose full target remains at least 64px.

Implement `MobileCanvas`, `PageHeader`, and `AppShell` with these signatures:

```ts
export interface MobileCanvasProps {
  children: React.ReactNode;
  className?: string;
}

export interface PageHeaderProps {
  title: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface AppShellProps {
  children: React.ReactNode;
  activeNav: MainNavKey;
  header?: React.ReactNode;
  hideBottomNav?: boolean;
}
```

Use `max-w-[430px]`, `min-h-dvh`, `overflow-x-clip`, one semantic `<main className="pb-[104px]">`, and navigation fixed to the canvas rather than the browser edge.

- [ ] **Step 5: Temporarily wrap the current home page with AppShell**

Make the smallest change to `web/src/app/page.tsx` so the new shell and navigation can be tested. Preserve the existing `小智本地生活 AI 服务助手` heading; the full home composition arrives in Task 5.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
cd web
pnpm test src/components/layout/__tests__/bottom-navigation.test.tsx
pnpm test:e2e --grep "mobile shell"
```

Expected: navigation unit tests and all three viewport cases pass.

- [ ] **Step 7: Commit the shell**

```powershell
git add web/src/app/globals.css web/src/app/page.tsx web/src/lib/cn.ts web/src/components/layout web/e2e/mobile-shell.spec.ts
git diff --cached --check
git commit -m "feat(ui): add tokenized mobile application shell"
```

---

### Task 2: Accessible Common Controls

**Files:**
- Create: `web/src/components/ui/button.tsx`
- Create: `web/src/components/ui/icon-button.tsx`
- Create: `web/src/components/ui/tag.tsx`
- Create: `web/src/components/ui/source-badge.tsx`
- Create: `web/src/components/ui/search-bar.tsx`
- Create: `web/src/components/ui/section-header.tsx`
- Create: `web/src/components/ui/__tests__/controls.test.tsx`

**Interfaces:**
- Produces: `Button` with `primary | secondary | ghost | danger` variants.
- Produces: `IconButton` requiring an accessible `label`.
- Produces: `SourceCode = "housing_history_2024" | "supabase_mock" | "amap" | "knowledge_base" | "user_memory"`.
- Produces: controlled `SearchBar` with submit, loading, disabled, and label behavior.

- [ ] **Step 1: Write failing control behavior tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SearchBar } from "@/components/ui/search-bar";
import { SourceBadge } from "@/components/ui/source-badge";

describe("common controls", () => {
  it("forwards button refs and preserves native disabled behavior", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <Button ref={ref} disabled>
        提交
      </Button>,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "提交" }));
    expect(ref.current).toBeDisabled();
  });

  it("requires a visible accessible name for icon-only actions", () => {
    render(<IconButton label="收藏">+</IconButton>);
    expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
  });

  it("submits a controlled search value by keyboard", () => {
    const onSubmit = vi.fn();
    render(
      <SearchBar
        label="搜索本地生活服务"
        value="想找可养猫房源"
        onValueChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).toHaveBeenCalledWith("想找可养猫房源");
  });

  it("maps source codes to controlled user-facing labels", () => {
    render(<SourceBadge source="housing_history_2024" />);
    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd web
pnpm test src/components/ui/__tests__/controls.test.tsx
```

Expected: FAIL because the control modules do not exist.

- [ ] **Step 3: Implement the controls**

Use `forwardRef` or React 19 ref-compatible component props for native elements. Do not remove native button, form, input, or heading semantics.

`SearchBar` uses this contract:

```ts
export interface SearchBarProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}
```

Trim input before submission; do not call `onSubmit` for an empty value. Set `aria-busy` during loading, preserve a visible or screen-reader label, and maintain a 48px control height.

Use a closed `sourceLabels` mapping so callers cannot invent labels or colors:

```ts
const sourceLabels: Record<SourceCode, string> = {
  housing_history_2024: "2024 历史房源数据",
  supabase_mock: "演示业务数据",
  amap: "高德地图",
  knowledge_base: "知识库",
  user_memory: "已授权偏好",
};
```

- [ ] **Step 4: Run focused and complete unit tests**

```powershell
cd web
pnpm test src/components/ui/__tests__/controls.test.tsx
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit the controls**

```powershell
git add web/src/components/ui
git diff --cached --check
git commit -m "feat(ui): add accessible common controls"
```

---

### Task 3: Shared States and Development Component Gallery

**Files:**
- Create: `web/src/components/ui/states.tsx`
- Create: `web/src/components/ui/demo-notice.tsx`
- Create: `web/src/components/ui/__tests__/states.test.tsx`
- Create: `web/src/app/dev/components/page.tsx`
- Create: `web/src/app/dev/components/component-gallery.tsx`

**Interfaces:**
- Produces: `LoadingState`, `EmptyState`, `ErrorState`, and `DemoNotice`.
- Produces: development-only component gallery at `/dev/components`.

Use these state contracts:

```ts
export interface LoadingStateProps {
  message?: string;
}

export interface EmptyStateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export interface ErrorStateProps {
  title: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
}

export interface DemoNoticeProps {
  children: React.ReactNode;
}
```

- [ ] **Step 1: Write failing state tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DemoNotice } from "@/components/ui/demo-notice";
import { ErrorState } from "@/components/ui/states";

describe("shared UI states", () => {
  it("shows an honest demo notice", () => {
    render(<DemoNotice>当前内容为演示数据</DemoNotice>);
    expect(screen.getByRole("status")).toHaveTextContent("当前内容为演示数据");
  });

  it("shows a safe request id and supports retry", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="暂时无法加载"
        message="请稍后重试"
        requestId="request-123"
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByText(/request-123/)).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd web
pnpm test src/components/ui/__tests__/states.test.tsx
```

Expected: FAIL because state components do not exist.

- [ ] **Step 3: Implement shared states**

`LoadingState` uses `role="status"`; `ErrorState` uses `role="alert"`; `EmptyState` uses a semantic section; `DemoNotice` uses `role="status"`. Raw errors, stack traces, SQL, keys, and arbitrary HTML are not accepted.

- [ ] **Step 4: Build the development gallery**

Create the production gate in `web/src/app/dev/components/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { ComponentGallery } from "./component-gallery";

export default function ComponentsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <ComponentGallery />;
}
```

Create a real client gallery rather than passing callbacks across the Server Component boundary:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SearchBar } from "@/components/ui/search-bar";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";

export function ComponentGallery() {
  const [query, setQuery] = useState("");

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] space-y-8 bg-page px-4 py-8">
      <h1 className="text-page-title">组件展示</h1>

      <section aria-labelledby="gallery-buttons" className="space-y-3">
        <h2 id="gallery-buttons" className="text-section-title">
          按钮与标签
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button>主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button disabled>禁用按钮</Button>
          <Tag>已选择</Tag>
        </div>
      </section>

      <section aria-labelledby="gallery-search" className="space-y-3">
        <h2 id="gallery-search" className="text-section-title">
          搜索
        </h2>
        <SearchBar
          label="组件搜索示例"
          value={query}
          onValueChange={setQuery}
          onSubmit={setQuery}
        />
      </section>

      <section aria-labelledby="gallery-states" className="space-y-3">
        <h2 id="gallery-states" className="text-section-title">
          状态
        </h2>
        <LoadingState message="正在加载演示内容" />
        <DemoNotice>当前内容为演示数据</DemoNotice>
        <ErrorState
          title="暂时无法加载"
          message="请稍后重试"
          requestId="gallery-request"
        />
      </section>
    </main>
  );
}
```

This explicitly demonstrates default, loading, disabled, selected, demo, and error states without adding a generic Storybook abstraction.

- [ ] **Step 5: Run tests, lint, and build**

```powershell
cd web
pnpm test src/components/ui/__tests__/states.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

Expected: tests and quality commands pass; production route generation succeeds while `/dev/components` returns `notFound()` outside development.

- [ ] **Step 6: Commit states and gallery**

```powershell
git add web/src/components/ui web/src/app/dev/components/page.tsx web/src/app/dev/components/component-gallery.tsx
git diff --cached --check
git commit -m "feat(ui): add shared states and component gallery"
```

---

### Task 4: Typed Home Demo Content and Highlight Cards

**Files:**
- Create: `web/src/features/home/home-types.ts`
- Create: `web/src/features/home/home-demo-data.ts`
- Create: `web/src/components/home/home-highlight-card.tsx`
- Create: `web/src/components/home/home-highlights.tsx`
- Create: `web/src/components/home/__tests__/home-highlights.test.tsx`

**Interfaces:**
- Produces: discriminated `HomeHighlight` presentation type.
- Produces: immutable `homeHighlights` with four deterministic records.
- Produces: `HomeHighlightCard({ item }: { item: HomeHighlight })`.

- [ ] **Step 1: Define the wished-for test contract**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHighlights } from "@/components/home/home-highlights";
import { homeHighlights } from "@/features/home/home-demo-data";

describe("HomeHighlights", () => {
  it("renders four deterministic typed records", () => {
    render(<HomeHighlights items={homeHighlights} />);
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("labels housing as historical instead of currently available", () => {
    render(<HomeHighlights items={homeHighlights} />);
    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
    expect(screen.getByText(/2024 历史房源示例/)).toBeInTheDocument();
    expect(screen.queryByText(/随时入住|实时在租|当前可租/)).not.toBeInTheDocument();
  });

  it("marks other commercial records as demo content", () => {
    render(<HomeHighlights items={homeHighlights} />);
    expect(screen.getAllByText("演示业务数据")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

```powershell
cd web
pnpm test src/components/home/__tests__/home-highlights.test.tsx
```

Expected: FAIL because home types, data, and components do not exist.

- [ ] **Step 3: Implement the discriminated presentation model**

Use explicit variants:

```ts
interface HomeHighlightBase {
  id: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  location: string;
  isDemo: true;
}

export type HomeHighlight =
  | (HomeHighlightBase & {
      kind: "housing";
      source: "housing_history_2024";
      historicalYear: 2024;
      priceText: "¥3280/月";
      detail: string;
    })
  | (HomeHighlightBase & {
      kind: "deal";
      source: "supabase_mock";
      priceText: "¥128";
      detail: string;
    })
  | (HomeHighlightBase & {
      kind: "product";
      source: "supabase_mock";
      priceText: "¥16.9";
      detail: string;
    })
  | (HomeHighlightBase & {
      kind: "community";
      source: "supabase_mock";
      author: string;
      detail: string;
    });
```

Create exactly four records with stable ids. Use planned image paths under `/images/home/`; temporary CSS fallback blocks must keep tests and layout working before Task 6 assets arrive.

- [ ] **Step 4: Implement cards and grid**

Use semantic `<section aria-labelledby="home-highlights-title">` and `<article>`. Cards receive only `HomeHighlight`; they do not import repositories, process environment variables, or call APIs.

Use `SourceBadge` for source identity and `next/image` only when the local asset is present after Task 6. Before that integration, render a fixed-aspect tokenized fallback surface so this commit remains buildable.

- [ ] **Step 5: Run focused and complete tests**

```powershell
cd web
pnpm test src/components/home/__tests__/home-highlights.test.tsx
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit typed home content**

```powershell
git add web/src/features/home web/src/components/home
git diff --cached --check
git commit -m "feat(home): add typed demo highlights"
```

---

### Task 5: Honest Home Interactions and Full Page Composition

**Files:**
- Create: `web/src/components/home/home-location-header.tsx`
- Create: `web/src/components/home/home-search-experience.tsx`
- Create: `web/src/components/home/xiaozhi-hero.tsx`
- Create: `web/src/components/home/service-entry-grid.tsx`
- Create: `web/src/components/home/home-page.tsx`
- Create: `web/src/components/home/__tests__/home-interactions.test.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Produces: `HomePage()` server-safe composition.
- Produces: small client islands that manage only local input and unavailable notices.
- Consumes: Task 1 shell, Task 2 controls, Task 3 notices, Task 4 highlights.

- [ ] **Step 1: Write failing interaction and composition tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "@/components/home/home-page";

describe("HomePage", () => {
  it("renders every required home section", () => {
    render(<HomePage />);
    expect(screen.getByText("杭州 · 武林广场")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "小智本地生活 AI 服务助手" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "附近精选" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
  });

  it("keeps quick prompts local and never claims an AI request was sent", () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "找宠物友好房源" }));
    expect(screen.getByRole("searchbox")).toHaveValue("找宠物友好房源");
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "小智对话将在下一阶段接通",
    );
    expect(screen.queryByText(/查询成功|已经找到/)).not.toBeInTheDocument();
  });

  it("explains unavailable service entries instead of navigating to a missing route", () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "租房" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "租房功能将在下一阶段开放",
    );
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

```powershell
cd web
pnpm test src/components/home/__tests__/home-interactions.test.tsx
```

Expected: FAIL because home composition modules do not exist.

- [ ] **Step 3: Implement the home sections**

`HomeSearchExperience` and `ServiceEntryGrid` are the only client components. They hold local state, use `SearchBar`/`DemoNotice`, and make no request.

Quick prompts are exactly:

```ts
[
  "找宠物友好房源",
  "附近有什么好吃的",
  "今晚买点菜",
  "团购退款规则",
]
```

Service entries are exactly:

```ts
[
  { label: "租房", description: "整租 · 合租", icon: Building2 },
  { label: "团购", description: "美食 · 玩乐", icon: TicketPercent },
  { label: "超市", description: "生鲜 · 日用", icon: ShoppingBasket },
  { label: "周边", description: "服务 · 出行", icon: MapPinned },
]
```

Use real headings, forms, buttons, sections, and text. Do not make card-sized `<div>` click targets without button semantics.

- [ ] **Step 4: Replace the temporary page with HomePage**

`web/src/app/page.tsx` becomes:

```tsx
import { HomePage } from "@/components/home/home-page";

export default function Page() {
  return <HomePage />;
}
```

- [ ] **Step 5: Run focused, complete, and accessibility-relevant tests**

```powershell
cd web
pnpm test src/components/home/__tests__/home-interactions.test.tsx
pnpm test
pnpm lint
pnpm typecheck
```

Expected: all commands pass.

- [ ] **Step 6: Commit the composed page**

```powershell
git add web/src/app/page.tsx web/src/components/home
git diff --cached --check
git commit -m "feat(home): assemble honest interactive home page"
```

---

### Task 6: Generate and Integrate Original Local Home Imagery

**Files:**
- Create: `web/public/images/home/xiaozhi-mascot.png`
- Create: `web/public/images/home/housing-history-2024.png`
- Create: `web/public/images/home/group-buy-hotpot.png`
- Create: `web/public/images/home/fresh-produce.png`
- Create: `web/public/images/home/hangzhou-community.png`
- Modify: `web/src/components/home/xiaozhi-hero.tsx`
- Modify: `web/src/components/home/home-highlight-card.tsx`

**Interfaces:**
- Produces: five local image assets with no baked-in UI or readable copy.
- Consumes: stable layout and aspect ratios from Tasks 4–5.

- [ ] **Step 1: Read and invoke the imagegen skill**

Read `C:\Users\Administrator\.codex\skills\.system\imagegen\SKILL.md` completely before generation. Inspect the approved prototype only as visual direction.

- [ ] **Step 2: Generate the mascot asset**

Use this prompt, adjusting only technical output instructions required by the skill:

```text
Create a friendly original compact AI assistant mascot for a Chinese local-life mobile product. Glossy white rounded robot body, deep navy face screen, cyan smiling eyes, subtle cobalt-blue and violet accents, approachable premium 3D product illustration, soft studio lighting, isolated composition with transparent or very pale gradient background. No text, no letters, no logo, no watermark, no speech bubbles, no UI controls. The mascot must remain readable at small mobile-card size and leave breathing room around the silhouette.
```

Save the accepted output as `web/public/images/home/xiaozhi-mascot.png`.

- [ ] **Step 3: Generate four coherent cover assets**

Generate one image per prompt family, all with the same bright editorial-commercial photographic direction and no text, logos, watermarks, prices, UI, or people with identifiable faces:

```text
Housing: warm sunlit compact Hangzhou rental studio interior, tidy modern furniture, neutral cream and pale blue palette, believable residential photography, 4:3 composition.

Group buy: inviting Chinese hotpot meal for two, rich red broth and neatly arranged ingredients, clean restaurant table, vivid but realistic food photography, 4:3 composition.

Fresh produce: premium green grapes, peaches and cherries arranged in a clean grocery still life, bright natural light, fresh and realistic, 4:3 composition.

Community: Hangzhou West Lake lakeside promenade in spring, flowering trees, distant skyline, friendly local-life atmosphere, no prominent identifiable faces, 4:3 composition.
```

Save to the four exact paths listed above.

- [ ] **Step 4: Inspect every generated asset**

Use `view_image` on each file. Reject and regenerate any asset containing text, watermarks, UI, malformed objects, strong brand imitation, or a composition that fails at card size.

- [ ] **Step 5: Integrate with Next Image and fallbacks**

Use `next/image` with explicit `sizes`, responsive `fill`, semantic alt text for informative covers, empty alt for decorative mascot use, and a tokenized background behind every image. Keep text and interactive controls outside the bitmap.

- [ ] **Step 6: Run tests and production build**

```powershell
cd web
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all assets resolve locally and the production build passes without remote image hosts.

- [ ] **Step 7: Commit the local imagery**

```powershell
git add web/public/images/home web/src/components/home/xiaozhi-hero.tsx web/src/components/home/home-highlight-card.tsx
git diff --cached --check
git commit -m "feat(home): add original local imagery"
```

---

### Task 7: Final Responsive, Interaction, and Scope Verification

**Files:**
- Modify: `web/e2e/mobile-shell.spec.ts`
- Create: `web/e2e/home.spec.ts`
- Modify only if a test proves necessary: Task 1–6 implementation files

**Interfaces:**
- Produces: browser evidence for responsive layout and honest unavailable behavior.

- [ ] **Step 1: Add complete home browser tests**

Create `web/e2e/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("home page renders its complete presentation structure", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "小智本地生活 AI 服务助手" }),
  ).toBeVisible();
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.getByRole("heading", { name: "附近精选" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
});

test("search stays local and reports its unavailable boundary", async ({ page }) => {
  await page.goto("/");
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });

  await page.getByRole("searchbox").fill("帮我找房");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("status")).toContainText(
    "小智对话将在下一阶段接通",
  );
  expect(apiRequests).toEqual([]);
});
```

Extend `mobile-shell.spec.ts` with:

```ts
await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(1);
const navigationBox = await page
  .getByRole("navigation", { name: "主导航" })
  .boundingBox();
expect(navigationBox).not.toBeNull();
expect(navigationBox!.x).toBeGreaterThanOrEqual(0);
expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(width);
```

- [ ] **Step 2: Run browser tests and verify failures are behavior-related**

```powershell
cd web
pnpm test:e2e --grep "home page|search stays local|mobile shell"
```

If a new assertion already passes, keep it only if it protects an observable requirement not already covered. If it fails, confirm the failure describes layout, semantics, or behavior rather than selector syntax before changing production code.

- [ ] **Step 3: Make only evidence-driven fixes**

Fix the smallest component responsible for any proven failure. Do not add Task 3 routes, APIs, repositories, or external integrations while repairing responsive behavior.

- [ ] **Step 4: Run every quality gate from a fresh state**

```powershell
cd web
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected evidence:

- Prettier: no formatting differences.
- ESLint: zero errors.
- TypeScript: route types generated and zero errors.
- Vitest: all component and contract tests pass.
- Next build: `/` and `/api/health` build successfully; `/dev/components` remains development-gated.
- Playwright: Chromium tests pass at 360px, 390px, 430px and default desktop viewport.

- [ ] **Step 5: Audit secrets, data truthfulness, and scope**

Run:

```powershell
git status --short
rg -n "随时入住|实时在租|当前可租|查询成功|已经找到" web/src web/e2e
rg -n "SUPABASE_SERVICE_ROLE_KEY|DASHSCOPE_API_KEY|AMAP_WEB_SERVICE_KEY" web/.next/static
rg --files web/src/app
```

Expected:

- Prohibited success/current-availability wording appears only in negative tests, not product UI.
- No server-only key names or values appear in client static bundles.
- No Task 3 business route files were created.
- Only generated build/test artifacts are ignored; all intended source and images are tracked.

- [ ] **Step 6: Commit final test and responsive fixes**

```powershell
git add web/e2e web/src web/public/images/home
git diff --cached --check
git commit -m "test(home): verify responsive demo experience"
```

If there are no source changes after Step 4, do not create an empty commit.

- [ ] **Step 7: Stop and report**

Report exact commits, test counts, build result, generated asset paths, demo/unavailable boundaries, known Task 3 gaps, and clean worktree status. Do not start Task 3, connect external services, create a tag, or push.
