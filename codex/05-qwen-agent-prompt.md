# Phase 5：千问 Agent 与工具调用

执行实施计划 Task 5 和 Task 6，但每次只完成一个 Task 并停下。

## Provider

- 使用 `openai` npm SDK 作为百炼 OpenAI-compatible client。
- `baseURL`、model 和 key 只从 server env 读取。
- 定义 `AIProvider` 接口和 `QwenProvider` 实现，测试使用 `FakeAIProvider`。
- Chat Completions 流程：模型请求工具 → 应用校验/执行 → 追加 tool result → 模型继续，最多 8 轮。

## Tool registry

严格按 `contracts/tool-contracts.json` 注册工具，使用 Zod 进行第二次参数校验。每个工具：

- 单一职责
- 8 秒超时
- 稳定错误码
- 写入 `ai_tool_runs`
- 返回最小必要 JSON
- 同一轮相同参数去重

## `/api/chat`

采用 SSE 事件契约，支持 abort、流式文本、工具公开进度、结构化卡片、引用和 debug 面板。工具名和内部参数不进入普通用户正文。

先完成 `search_houses`、`search_deals`、`search_products`、`get_product_stock` 和用户偏好工具；地图与 RAG 分别在后续 phase 接入。
