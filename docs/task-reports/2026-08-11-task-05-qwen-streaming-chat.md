# Task 5 验证报告：千问 Provider 与流式聊天基础

日期：2026-08-11

## 交付范围

- Provider 中立的消息、流事件与工具调用接口。
- 基于 `openai` SDK 的百炼 OpenAI-compatible `QwenProvider`。
- 可预测、可注入失败的 `FakeAIProvider`，只用于测试和显式演示模式。
- 严格 Zod 校验的 `/api/chat` 请求和外部模型流响应。
- SSE 编码、增量解析、Unicode 分块、状态归并与协议错误处理。
- 模型超时、浏览器取消、请求中断和不完整响应保护。
- 签名 HttpOnly 匿名会话 Cookie，以及服务端会话所有权校验。
- Supabase 对话创建、最近消息读取、用户消息写入、助手回答与 token 用量写入。
- 聊天 UI 从本地定时脚本切换为真实 `/api/chat` 流读取。

本阶段只建立模型与对话基础，不执行业务、地图或知识工具。模型请求工具时会返回明确警告，不会伪造工具结果。工具注册表与首批业务工具属于 Task 6。

## 运行模式

### 演示模式

`NEXT_PUBLIC_DEMO_MODE=true` 时使用 `FakeAIProvider` 和临时内存会话：

- UI 明确显示没有调用真实千问或外部工具。
- 不写入 Supabase，不声称已保存云端记录。
- 不返回未经工具核验的价格、库存、距离或政策。

### 真实模式

`NEXT_PUBLIC_DEMO_MODE=false` 时要求同时配置：

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_MODEL`
- Supabase URL、publishable key 和 service role key
- 独立的 `ANONYMOUS_COOKIE_SECRET`，至少 32 字节

任一关键配置缺失时返回稳定 JSON 错误和 503，不会静默降级为演示模型。

## 安全与权限边界

- 百炼 key、Supabase service role 和 Cookie 签名密钥只在服务端模块读取。
- 匿名 ID 使用 32 字节随机值和 HMAC-SHA256 签名，Cookie 为 HttpOnly、SameSite=Lax，生产环境启用 Secure。
- 匿名会话写入通过 service role 完成，但每次恢复会话前必须验证签名 Cookie 中的 owner；越权统一返回 403。
- 没有向浏览器开放匿名写 RLS Policy。
- 请求、上下文对象和模型流分块均经过 Zod 白名单校验。
- 公共错误只包含稳定 code、中文 message、retryable 和 requestId，不返回原始上游错误或凭据。

## 自动验证证据

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：34 个测试文件、126 项测试全部通过
- `pnpm build`：通过，31 个页面完成生产构建，`/api/chat` 为动态服务端路由
- `pnpm test:e2e`：Chromium 37 项全部通过
- `pnpm preview:capture`：26 个页面模板全部完成 430px 长截图，聊天页包含流式回答完成态

覆盖场景包括：请求未知字段拒绝、模型 Unicode 增量、工具参数分片、超时、取消、上游失败、不完整流、SSE 畸形帧、Cookie 篡改、跨匿名用户会话拒绝、持久化失败降级和密钥不泄露。

## 尚未形成的证据

当前环境没有真实 `DASHSCOPE_API_KEY`，因此没有执行百炼线上 smoke test，也不能宣称真实千问已经连通。`QwenProvider` 的请求映射、流解析、错误归一化和取消行为由 Fake client 契约测试验证；配置真实密钥后仍需在预发布环境完成一次受控在线验证。

Task 6 接入首批业务工具后，才会产生 `tool_progress`、结构化结果卡和真实工具运行记录。
