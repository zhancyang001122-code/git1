# Xiaozhi Task 2.5 Design System and Home Page Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** Existing Task 2 plus one presentation-complete home page

## 1. Goal

Build the reusable mobile design foundation and use it immediately to assemble a portfolio-quality Xiaozhi home page. The result must look complete at 360–430px, remain honest about unavailable capabilities, and create reusable components for later business pages.

This phase proves two things:

1. the product has a coherent visual and accessibility system;
2. the same component contracts can assemble a real page without duplicating navigation or styles.

## 2. Scope

### Included

- 430px `MobileCanvas` and reusable `AppShell`.
- `PageHeader` and the single shared five-item `BottomNavigation`.
- Design tokens for color, typography, spacing, radius, shadow, size, and safe area.
- Common controls: `Button`, `IconButton`, `Tag`, `SourceBadge`, `SearchBar`, `SectionHeader`.
- Shared states: loading, empty, error, and `DemoNotice`.
- Development-only `/dev/components` component gallery.
- A complete home-page composition following `design/prototypes/01-home.png` as visual direction.
- Typed, deterministic home-page demo content with visible demo labels.
- Original local raster assets for the mascot and content covers.
- Unit, accessibility, responsive, and browser smoke tests.

### Excluded

- Supabase, the housing API, Qwen, AMap, RAG, or any external network call.
- Full Task 3 repositories, all business routes, chat, favorites, cart, orders, or payments.
- Claims that search, booking, navigation, or AI conversation is already connected.
- Copying the prototype image into the product UI or baking text and controls into generated images.

## 3. Page and Component Architecture

```text
Home route (server component)
└── MobileCanvas
    └── AppShell(activeNav="home")
        ├── HomeLocationHeader
        ├── HomeSearchExperience (small client island)
        ├── XiaozhiHero
        ├── ServiceEntryGrid
        ├── HomeHighlights
        │   └── HomeHighlightCard
        └── BottomNavigation
```

`page.tsx` remains a server component. Only the search and unavailable-feature feedback need client state. The navigation, cards, data definitions, and layout remain usable without browser-side JavaScript.

`BottomNavigation` is rendered only by `AppShell`; individual pages cannot create their own copy.

## 4. Layout and Visual Rules

- The page canvas is full width from 360px through 430px and centered above 430px.
- Desktop space outside the canvas uses the design-system background.
- The canvas clips horizontal overflow and uses `min-height: 100dvh`.
- Main content reserves at least 104px at the bottom for navigation and safe area.
- Navigation height is 76px plus `env(safe-area-inset-bottom)`.
- All interaction targets are at least 44×44px.
- The central Xiaozhi control is 64px and raised 14px.
- Component colors and sizes come from tokens; callers cannot invent per-card color values.
- Focus indicators remain visible and animations respect `prefers-reduced-motion`.

The implementation follows the prototype's hierarchy rather than copying its pixels: location, search, AI hero, four service entries, nearby highlights, and bottom navigation.

## 5. Home Page Content

### Location

Show `杭州 · 武林广场` from safe public defaults. It is a display value in this phase, not verified device positioning.

### Search

The user may type a question. Submitting does not navigate to a fake chat page. It shows an inline notice explaining that Xiaozhi conversation will be connected in Task 3 and retains the typed text in the current component state.

Quick prompts populate and focus the search field. They do not claim that an AI request was sent.

### Xiaozhi Hero

Show the product identity, a local original mascot image, and four quick prompts. Text and controls are real HTML, never pixels embedded in the mascot image.

### Service Entries

Show renting, group buying, market, and nearby services. Until their routes exist, they use semantic buttons that reveal an honest unavailable notice instead of linking to a 404 or pretending success.

### Nearby Highlights

Show four typed presentation records: historical housing example, mock group-buy deal, mock market product, and mock community post. Each record contains a stable id, discriminated `kind`, local image path, display fields, source label, and `isDemo: true`.

The housing example must be labelled as a 2024 historical example, not a current available listing. The other commercial records must carry visible mock/demo labels.

## 6. Image Asset Strategy

Use the `imagegen` skill during implementation to create original, local raster assets:

- one Xiaozhi mascot/hero asset with no text;
- one housing interior cover;
- one restaurant/group-buy cover;
- one fresh produce cover;
- one Hangzhou community/lakeside cover.

Store optimized outputs under `web/public/images/home/`. Images must not contain UI controls, prices, labels, logos, watermarks, or readable copy. Every rendered image receives useful alt text or an empty alt when decorative. CSS gradients and Lucide icons provide a stable fallback if an asset is unavailable.

Remote hotlinks are forbidden so builds and demos do not depend on third-party image availability.

## 7. Component Contracts

- `AppShell({ children, activeNav, header?, hideBottomNav? })` owns page layout and the single navigation landmark.
- `BottomNavigation({ active })` accepts only `home | discover | xiaozhi | messages | me`.
- `SearchBar` exposes controlled value, submit callback, label, placeholder, loading, and disabled states.
- `SourceBadge` maps fixed source codes to controlled labels and styles.
- `HomeHighlightCard` consumes a discriminated presentation model, not a database row.
- Shared state components accept safe user-facing text and optional retry callbacks; they never expose stack traces or raw errors.

## 8. Data and Interaction Flow

```text
typed local demo data
→ server Home route
→ presentational sections and cards

user input
→ client search island
→ local validation
→ honest unavailable notice
```

No API request occurs in this phase. The seam is intentional: Task 3 can replace the local submit callback with validated navigation and chat context without rewriting the visual component.

## 9. Testing and Acceptance

### Unit and component tests

- Exactly five navigation links with fixed hrefs.
- Exactly one navigation landmark.
- Active item has `aria-current="page"`.
- Central Xiaozhi item has an accessible name and minimum target size.
- Search supports labels, keyboard submission, disabled/loading states, and honest unavailable feedback.
- All demo highlight records render a source/demo indicator.
- The 2024 housing example never uses current-availability wording.

### Browser tests

- At 360px, 390px, and 430px, document width never exceeds viewport width.
- Home heading, search, hero, service entries, highlights, and navigation are visible.
- Navigation remains visible and no duplicate navigation landmark exists.
- Search submission produces the unavailable notice without a network request or 404 navigation.

### Quality gates

```powershell
cd web
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## 10. Delivery Boundary

The phase is complete only when the home page is visually coherent, responsive, accessible, locally reproducible, and explicit about demo/unavailable behavior. It is not complete merely because a screenshot looks similar to the prototype.

The implementation will use a feature branch, Conventional Commits, no release tag, and no GitHub push unless separately requested.
