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

## `POST /api/chat`

请求：`chatRequestSchema`。响应：`text/event-stream; charset=utf-8`。

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

## `GET /api/houses`

查询参数：`city`、`district`、`minPrice`、`maxPrice`、`roomType`、`petsAllowed`、`sort`、`cursor`、`limit`。未知参数、重复参数、非法数字或布尔值返回 `BUSINESS_QUERY_INVALID`。

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

匿名演示用户使用固定 demo profile；接入 Auth 后按 `auth.uid()` 隔离。PATCH 使用 `preferencePatchSchema`，每次写入都记录 consent timestamp。

## `POST /api/feedback`

请求使用 `feedbackRequestSchema`，必须验证 `sessionId` 与 `messageId` 属于当前用户或匿名会话。点赞只记录反馈；点踩原因属于 `incorrect`、`missing_source` 或 `outdated` 时创建去重的 `knowledge_candidates`，但不会更新 `kb_articles`。

反馈是用户发起的受控应用操作，不注册为 Agent 工具。模型不能代替用户点赞、点踩、纠错或发布知识。

## `POST /api/knowledge/search`

仅服务端内部调用。输入为 `search_knowledge` 工具参数，返回检索片段、融合分数、引用和 `lowConfidence`。

## `POST /api/knowledge/publish`

演示管理员接口。使用受服务端签名保护的 HttpOnly 管理会话 Cookie，脚本或自动化调用也可使用 `Authorization: Bearer <DEMO_ADMIN_TOKEN>`。动作顺序：创建新版本、发布、建立索引、执行关联评测；响应分别返回发布、索引、评测和可检索状态，不把部分成功描述为全部成功。

## 知识运营管理 API

- `POST /api/knowledge/admin-session`：表单口令换取四小时 HttpOnly 会话 Cookie；口令不进入 URL 或客户端脚本。
- `GET /api/knowledge/candidates`：列出候选队列。
- `POST /api/knowledge/candidates`：保存草稿或提交批准、驳回、退回修改决策。
- `POST /api/knowledge/evaluate`：执行关联评测并返回通过数与得分。
- `POST /api/knowledge/rollback`：只有存在上一已发布版本时才能回滚；没有回滚目标时返回稳定的 `409` 错误。

上述 API 均要求管理会话或 Bearer Token，响应带 `cache-control: no-store` 与 `x-request-id`。

## `GET /api/health`

返回应用、Supabase、Qwen、AMap 的配置可用性，不返回任何密钥。外部服务只做轻量连通性检查或报告 `not_checked`。
