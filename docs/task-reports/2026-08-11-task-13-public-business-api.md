# Task 13 验证报告：公开业务 API 与契约对齐

## 本次解决的问题

根目录 `contracts/api-contracts.md` 已定义房源、团购、商品和社区内容的只读列表 API，但此前 Next.js 路由不存在。页面虽然可以通过 React Server Component 直接读取 Repository，外部调用方和面试演示却无法按契约访问这些接口，属于文档与实现不一致。

同时，根工具契约曾包含 `submit_feedback`，而 Agent 注册表没有该工具。经权限边界复核，反馈必须由用户通过 UI 发起，并由 `/api/feedback` 验证消息归属；不应让模型代替用户点赞、点踩或纠错。因此本次删除了错误的模型工具契约，并增加完整契约一致性测试，避免以后再次静默漂移。

## 已实现

- 新增 `GET /api/houses`。
- 新增 `GET /api/deals`。
- 新增 `GET /api/products`。
- 新增 `GET /api/community-posts`。
- 四个接口共用稳定分页封装：`items`、`total`、`nextCursor`、`source`。
- 查询参数在创建 Repository 前经过 Zod 严格校验；未知、重复、非法数字和非法布尔值统一返回 `BUSINESS_QUERY_INVALID`。
- 响应明确区分 `demo`、`demo_fallback` 和 `supabase`，并给出 `isDemo` 与中文来源标签。
- 错误响应使用稳定公开结构，不返回底层异常正文。
- 所有响应设置 `cache-control: no-store` 和 `x-request-id`。
- 工具契约测试从“只比较已知子集”改为“根契约与实际 Provider 定义必须完全一致”。

## TDD 证据

1. 首次运行 `api-handlers.test.ts` 时因 `api-handlers` 模块不存在而失败，证明测试先于实现。
2. 增加实现后，聚焦测试 4/4 通过；随后新增小数商品价格用例，先得到 400 失败，再修正为 5/5 通过。
3. 收紧工具契约测试后，测试因多出的 `submit_feedback` 根契约而失败。
4. 修正权限契约并补齐价格边界后，两个聚焦测试文件共 9/9 通过。

## 完整质量门

- `pnpm lint`：PASS。
- `pnpm typecheck`：PASS。
- `pnpm test`：PASS，89 个测试文件、311 条测试。
- `pnpm build`：PASS，构建清单包含四个新增动态 API。
- `PLAYWRIGHT_PORT=3314 pnpm test:e2e`：PASS，47 通过、1 跳过；跳过项要求另行启动本机历史房源服务。
- `pnpm format:check`：PASS。检查曾发现 8 个格式不一致文件，已按仓库 Prettier 规则机械修正。

## 仍未完成

- `GET /api/preferences` 与 `PATCH /api/preferences` 仍只有根契约，没有 Next.js 路由；需要单独设计 Demo 非持久化语义、登录用户身份校验和授权时间更新。
- 本次没有连接 Supabase、高德、千问或正式知识材料，也没有执行任何在线服务调用。
- 四个接口的 Supabase Live 来源仍需在用户项目配置后做 HTTP smoke test；当前通过的是 Demo 端到端与 Repository 契约。
