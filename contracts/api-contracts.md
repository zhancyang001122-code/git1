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
data: {"id":"...","label":"正在查询房源","status":"running","source":"supabase_mock"}

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

查询参数：`district`、`minPrice`、`maxPrice`、`roomType`、`petsAllowed`、`sort`、`cursor`。

返回：

```json
{
  "items": [],
  "nextCursor": null,
  "source": { "source": "supabase_mock", "label": "演示房源数据", "isDemo": true }
}
```

## `GET /api/deals`, `GET /api/products`, `GET /api/community-posts`

采用同一分页封装。列表默认只返回 active/published 数据。

## `GET /api/preferences` / `PATCH /api/preferences`

匿名演示用户使用固定 demo profile；接入 Auth 后按 `auth.uid()` 隔离。PATCH 使用 `preferencePatchSchema`，每次写入都记录 consent timestamp。

## `POST /api/feedback`

请求使用 `feedbackRequestSchema`。点踩、纠错或低置信可创建 `knowledge_candidates`，但不会更新 `kb_articles`。

## `POST /api/knowledge/search`

仅服务端内部调用。输入为 `search_knowledge` 工具参数，返回检索片段、融合分数、引用和 `lowConfidence`。

## `POST /api/knowledge/publish`

演示管理员接口。请求头 `Authorization: Bearer <DEMO_ADMIN_TOKEN>`。动作：审核版本、标记 published、归档同文章旧版本、将 chunks 标记为待向量化、写审核日志。

## `GET /api/health`

返回应用、Supabase、Qwen、AMap 的配置可用性，不返回任何密钥。外部服务只做轻量连通性检查或报告 `not_checked`。
