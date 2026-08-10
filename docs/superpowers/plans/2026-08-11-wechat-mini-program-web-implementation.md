# 小智微信小程序式 Web Implementation Plan

**Goal:** 在不改变 Next.js、Supabase、Agent、Maps 和 Knowledge 架构的前提下，把全部用户页面统一改造成“微信小程序结构 × 小智品牌”的可演示 Web，并保留数据来源、降级和可访问性。

**Architecture:** 公共视觉行为集中在 Layout 和 UI primitives；业务页面只组合组件，不复制导航、弹层、Toast 或确认逻辑。视觉改造不得把数据库、地图或模型调用移入 React 页面。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS 4、Lucide React、Vitest、Testing Library、Playwright。

## Global Constraints

- 保留最大 430px Web 画布和 Vercel 部署，不引入微信原生、Taro 或 uni-app。
- 不模拟系统状态栏，不复制微信商标，不声称可以提交微信审核。
- 主品牌继续使用蓝紫色；`#07C160` 仅用于成功状态。
- 五栏 BottomNavigation 扁平等分，小智不再上浮。
- 所有胶囊、返回、弹层和确认按钮必须具备真实行为。
- 交互目标至少 44px；弹层支持 Esc、焦点管理和 `aria-*`。
- 数据真实性标签、Demo/Live 状态和错误降级不得因视觉改造被削弱。
- 每个 Task 先补测试或更新验收，再实现并运行相关测试。

---

## Task 1: Global tokens and app shell

**Files:**

- Modify: `web/src/app/globals.css`
- Modify: `web/src/components/layout/mobile-canvas.tsx`
- Modify: `web/src/components/layout/app-shell.tsx`
- Modify: `web/src/components/layout/page-header.tsx`
- Modify: `web/src/components/layout/detail-shell.tsx`
- Modify: `web/src/components/layout/bottom-navigation.tsx`
- Create: `web/src/components/layout/mini-program-capsule.tsx`
- Modify/Create tests under `web/src/components/layout/__tests__/`

**Steps:**

1. 更新 BottomNavigation 测试，断言五栏等分、小智无突出结构、当前页有 `aria-current`。
2. 为 PageHeader/胶囊编写测试：标题居中，更多按钮可用，返回首页链接有效，二级页返回有效。
3. 更新全局 Token：页面背景、48px 顶栏、40px 搜索、56px 底栏、12px 卡片和克制阴影。
4. 实现 `MiniProgramCapsule`；“更多”打开菜单，“返回首页”使用真实链接。
5. 改造 `PageHeader` 为三列网格，让标题不受左右操作宽度影响。
6. 改造 `AppShell` 和 `DetailShell` 的 safe area 与内容留白。
7. 运行 Layout 测试、lint 和 typecheck。

## Task 2: Mini-program interaction primitives

**Files:**

- Create: `web/src/components/ui/action-sheet.tsx`
- Create: `web/src/components/ui/toast.tsx`
- Create: `web/src/components/ui/confirm-dialog.tsx`
- Create: `web/src/components/ui/cell-group.tsx`
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/ui/demo-notice.tsx`
- Create tests in `web/src/components/ui/__tests__/`

**Steps:**

1. 先写 ActionSheet 的打开、遮罩关闭、Esc、焦点回收测试。
2. 写 Toast 的 `aria-live`、自动消失和手动关闭测试。
3. 写 ConfirmDialog 的取消、确认和可访问名称测试。
4. 写 CellGroup 分隔线、辅助文字、状态和链接测试。
5. 实现 primitives，复用现有 Token，不引入第二套组件库。
6. 调整 Button 和 DemoNotice 的尺寸与小程序式视觉。
7. 运行 UI 组件测试、lint 和 typecheck。

## Task 3: Home and Xiaozhi experience

**Files:**

- Modify: `web/src/components/home/home-page.tsx`
- Modify: `web/src/components/home/home-location-header.tsx`
- Modify: `web/src/components/pages/xiaozhi-welcome-page.tsx`
- Modify: `web/src/components/chat/chat-experience.tsx`
- Modify: `web/src/components/chat/agent-progress-list.tsx`
- Modify: `web/src/components/chat/agent-result-cards.tsx`
- Modify related tests

**Steps:**

1. 更新页面测试，断言正式文案、小程序导航、来源标签和固定 Composer。
2. 首页改为地点行、40px 搜索、AI 主卡、四宫格和紧凑内容卡；删除“后续将”文案。
3. 小智欢迎页改为任务宫格、推荐问题和固定 Composer。
4. 对话明确分层：用户气泡、小智内容、工具步骤、结果卡、引用和错误。
5. 保留流式、取消、重试、反馈和 Debug 行为。
6. 运行 Home/Xiaozhi/Chat 测试与 430px 页面截图检查。

## Task 4: Discover, Messages and Me

**Files:**

- Modify: `web/src/components/pages/discover-page.tsx`
- Modify: `web/src/components/pages/messages-page.tsx`
- Modify: `web/src/components/pages/me-page.tsx`
- Modify: `web/src/components/pages/account-utility-actions.tsx`
- Modify account utility pages and related tests

**Steps:**

1. 推荐筛选改为紧凑标签/ActionSheet，“问小智”保留上下文跳转。
2. 消息页改为 CellGroup，统一头像、未读、时间和副标题对齐。
3. 我的页使用用户头部、统计 Cell 和设置 CellGroup；危险操作独立分组。
4. 收藏、偏好等轻量操作接 Toast；删除或覆盖操作接 ConfirmDialog。
5. 运行主页面和账户页面测试。

## Task 5: Business and operations pages

**Files:**

- Modify house/deal/market/nearby/cart/detail components and pages
- Modify knowledge-admin components and pages
- Modify related component and repository-backed page tests

**Steps:**

1. 房源筛选、排序改为 ActionSheet；`2024 历史房源`标签保持醒目。
2. 团购、超市和购物车改为紧凑业务卡与小程序式操作反馈，始终标记演示业务。
3. 周边定位改为主动授权；拒绝后提供武林广场演示位置；高德失败支持局部重试。
4. 详情页统一顶部导航、返回和功能胶囊。
5. 知识运营保留移动演示标签，审核、驳回、发布和索引使用确认反馈。
6. 运行业务页面、地图和知识运营相关测试。

## Task 6: Regression, visual QA and delivery

**Files:**

- Modify E2E selectors/specs where structure legitimately changed
- Create task report under `docs/task-reports/`
- Generate previews outside Git worktree

**Steps:**

1. 运行 `pnpm format`，检查只格式化本任务文件。
2. 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
3. 运行 `pnpm test:e2e`，验证 360/390/430px、五主页面和三条核心链路。
4. 在浏览器检查 console、键盘导航、Esc、定位拒绝和 reduced motion。
5. 生成首页、推荐、小智、消息、我的、房源、团购、超市、周边、知识运营预览。
6. 编写真实状态报告，不把仍未接通的 RAG 或外部密钥能力标为完成。
7. 使用 Conventional Commit 提交：`feat(ui): adopt mini program web experience`。

## Merge and continuation

1. 将 `codex/mini-program-ui` 合并到 `main`。
2. 把 UI 提交合并回 `codex/rag-knowledge-service`，解决知识引用组件与新 Chat UI 的集成。
3. 继续完成 Task 8 RAG、API、E2E 和预览。
