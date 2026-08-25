# API 契约

所有 API 均位于 Next.js `web/src/app/api/`，服务端密钥不得进入浏览器 bundle。JSON 错误响应统一为：

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "面向用户的中文说明",
    "retryable": true,
    "requestId": "uuid"
  }
}
```

所有 Auth 与用户数据响应使用 `cache-control: no-store` 和 `x-request-id`。状态变更接口校验同源请求。当前面试演示版本不开放公众注册，也不发送邮箱或短信验证码。Production 使用公开固定演示码 `666666`，服务端将它映射到一个隔离、共享的 Supabase 演示用户；`DEMO_AUTH_EMAIL` 与 `DEMO_AUTH_PASSWORD` 只存在于服务端环境变量，任一缺失时 Auth 安全停用。该方案用于低频作品集演示，不等于生产级用户认证。

## `POST /api/auth/demo-login`

请求使用 strict Schema，包含 6 位数字 `code` 和可选 `next`。服务端执行 Same-Origin、4 KiB 请求体上限和轻量固定窗口限流，只接受 `666666`，随后以服务端保存的随机凭据调用 Supabase `signInWithPassword()` 并写入真实 SSR Auth Cookie。响应只返回 `{ "ok": true, "next": "..." }`，不会返回演示邮箱、密码或 Session 内容；外部 URL、协议相对 URL、反斜杠和控制字符回退到 `/me`。错误码固定为 `AUTH_DEMO_CODE_INVALID`、`AUTH_RATE_LIMITED` 或 `AUTH_UNAVAILABLE`。

## `POST /api/auth/sign-out`

注销当前浏览器会话并清理 Auth Cookie，不删除偏好或其他用户数据。没有现存会话时仍返回幂等成功。

## `POST /api/chat`

请求：`chatRequestSchema`。响应：`text/event-stream; charset=utf-8`。

可选位置上下文必须作为完整一组传入：`location`（高德 GCJ-02）、`locationWgs84`、`locationLabel`、`locationCity`。只提供其中一部分返回 `INVALID_CHAT_REQUEST`。未在自然语言中指定其他地点时，地图工具使用 GCJ-02 坐标，历史房源工具使用 WGS84 坐标；自然语言中的明确地点优先。

SSE 示例：

```text
event: session
data: {"sessionId":"...","messageId":"..."}

event: tool_progress
data: {"id":"...","label":"正在查询房源","status":"running","source":"housing_history_2024"}

event: result_cards
data: {"cards":[{"kind":"house","data":{}}]}

event: assistant_delta
data: {"delta":"我找到"}

event: citations
data: {"citations":[]}

event: done
data: {"finishReason":"stop"}
```

规则：

- 先发 `session`，再发进度、卡片、文本和引用。
- 任一工具失败不直接结束整轮；Agent 判断能否降级。
- 第 8 轮工具调用后停止，并说明需要用户缩小范围。
- 浏览器断开时使用 `AbortSignal` 中止模型和工具请求。

## `POST /api/maps/nearby`

`action=resolve` 支持 `kind=manual`（城市 + 地点名称）和 `kind=browser`（浏览器 WGS84 坐标）。服务端通过高德地理编码、坐标转换或逆地理编码返回标准化地点，响应同时包含 `point`（高德 GCJ-02）和 `wgs84Point`。`action=search` 与 `action=route` 只接收高德坐标。API Key 仅在服务端使用。

## `GET /api/houses`

查询参数：`city`、`minPrice`、`maxPrice`、`roomType`、`sort`、`cursor`、`limit`。未知参数、重复参数或非法数字返回 `BUSINESS_QUERY_INVALID`。

返回：

```json
{
  "items": [],
  "nextCursor": null,
  "source": {
    "source": "housing_history_2024",
    "label": "2024 历史房源数据",
    "isDemo": false,
    "mode": "supabase"
  }
}
```

演示或故障回退时，`source` 必须改为 `supabase_mock`、`label` 改为“演示业务数据”、`isDemo` 改为 `true`，`mode` 分别为 `demo` 或 `demo_fallback`；客户端不得把两种来源合并展示。所有列表响应还包含 `total`，并设置 `cache-control: no-store` 与 `x-request-id`。

## `GET /api/deals`, `GET /api/products`, `GET /api/community-posts`

采用同一分页与来源封装，支持 `cursor` 和 `limit`。列表默认只返回 active/published 数据；这些商业记录在 V1.0 中仍是明确标记的演示业务，即使未来存放在 Supabase 中也不能描述成真实交易。

## `GET /api/preferences` / `PATCH /api/preferences`

仅登录用户可用。服务端通过 `auth.getUser()` 确定 `auth.uid()`，拒绝客户端 `userId` 或授权时间；用户会话 client 和 RLS 共同隔离数据。PATCH 使用 strict `preferencePatchSchema`：首次启用由服务端记录授权时间，后续修改记录更新时间；关闭长期记忆时删除该用户整行偏好。模型只能产生待确认提案，不能直接调用此 API 或写入偏好表。

## `POST /api/feedback`

请求使用 `feedbackRequestSchema`，必须验证 `sessionId` 与 `messageId` 属于当前用户或匿名会话。点赞只记录反馈；点踩原因属于 `incorrect`、`missing_source` 或 `outdated` 时创建去重的 `knowledge_candidates`，但不会更新 `kb_articles`。

反馈是用户发起的受控应用操作，不注册为 Agent 工具。模型不能代替用户点赞、点踩、纠错或发布知识。

## `POST /api/knowledge/search`

输入为 `search_knowledge` 工具参数，返回检索片段、融合分数、引用、`lowConfidence`、`warnings` 和 `rankingStrategy`。Production 正常重排必须返回 `hybrid_rerank`；重排失败时返回 `hybrid_rerank_fallback` 并包含 `RERANK_FALLBACK`，不得静默伪装为已重排。

## `POST /api/knowledge/publish`

演示管理员接口。使用受服务端签名保护的 HttpOnly 管理会话 Cookie，脚本或自动化调用也可使用 `Authorization: Bearer <DEMO_ADMIN_TOKEN>`。Live 模式在一个数据库事务内创建并发布新版本、写入持久化索引队列，随后立即返回 `indexStatus=queued`、`evaluationStatus=not_run`、`searchable=false`；独立 Worker 完成索引和关联评测后才更新最终状态。Demo 模式保留请求内确定性索引。响应不得把排队或部分成功描述为全部成功。

## 知识运营管理 API

- `POST /api/knowledge/admin-session`：表单口令换取四小时 HttpOnly 会话 Cookie；口令不进入 URL 或客户端脚本。
- `GET /api/knowledge/candidates`：列出候选队列。
- `POST /api/knowledge/candidates`：保存草稿，提交批准、驳回、退回修改决策，或使用 `action=create_draft` 受控录入一份人工材料。人工材料必须包含代表问题、正文、来源、负责人、领域、分类、版本号和生效日期；服务端原子创建候选与草稿，响应 `201`，状态只能是 `drafted`，不会绕过审核直接发布或进入检索。
- `POST /api/knowledge/evaluate`：执行关联评测并返回通过数与得分。
- `POST /api/knowledge/rollback`：只有存在上一已发布版本时才能回滚；没有回滚目标时返回稳定的 `409` 错误。
- `GET|POST /api/internal/knowledge-index-worker`：每次最多领取并处理一个持久化索引任务。Vercel Cron 使用 `Authorization: Bearer <CRON_SECRET>`，已登录管理页也可用签名 HttpOnly Cookie 手动触发；响应为 `idle`、`succeeded`、`retrying` 或 `failed`，不返回任何凭证。
- `GET /api/internal/ai-ops-monitor`：Vercel Cron 或已登录管理页触发六类阈值信号同步；除工具/RAG/索引信号外，还计算服务器收到请求至首个可见回答文本的 P95，以及带价格版本且完整覆盖的单会话模型成本估算。同一信号最多一个活跃事故，信号恢复会自动解决并追加审计事件。
- `GET /api/knowledge/incidents`：列出最近 20 个事故及状态、指标、认领人、处理说明和事件数量，不返回工具输入、对话或 Prompt。
- `POST /api/knowledge/incidents`：执行 `acknowledge` 或 `resolve`；只有已认领事故可以解决，解决必须包含 1–500 字处理说明。浏览器 Cookie 写操作必须 Same-Origin，Bearer 自动化保持独立。

上述 API 均要求管理会话或 Bearer Token，响应带 `cache-control: no-store` 与 `x-request-id`。事故主表可更新生命周期，事故事件仅允许服务端追加和读取，不能改写或删除。

## `GET /api/health`

返回应用、Supabase、Qwen、Qwen Rerank、AMap 和 Housing 的配置可用性，以及公开的部署 Git commit 标识；不返回任何密钥。外部服务只报告配置状态，真实连通性由 `pnpm interview:preflight` 调用受控业务接口验证。
