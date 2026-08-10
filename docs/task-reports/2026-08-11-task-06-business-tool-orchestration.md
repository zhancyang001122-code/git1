# Task 6 验证报告：业务工具、偏好与多轮编排

日期：2026-08-11

## 交付范围

- 严格注册 7 个首批工具：`search_houses`、`get_house_detail`、`search_deals`、`search_products`、`get_product_stock`、`get_user_preferences`、`save_user_preference`。
- 工具注册表、Zod 输入 Schema、执行器、业务实现和审计 Adapter 分层，UI 不直接访问数据库。
- 千问工具循环支持 assistant tool call、应用端执行、tool message 回传和模型继续生成，最多 8 轮。
- 相同工具和规范化后相同参数在单轮中只执行一次；非法参数允许修复一次，连续非法后阻断该工具。
- 每个工具默认 8 秒超时，支持浏览器取消和请求级中止，错误统一为稳定 `ToolError`。
- 房源、团购、商品、精确库存和长期偏好均返回最小稳定 JSON；价格、库存和状态不由模型补造。
- `/api/chat` 通过独立 SSE 事件输出公开进度、结构化卡片、警告、受控调试摘要和最终文本。

## 数据来源与产品边界

### 房源

- Supabase 正式读取的房源标为“2024 历史房源数据”。
- 历史记录不代表当前可租、当前租金或可签约状态。
- 显式演示模式或 Supabase 故障回退数据标为“演示业务数据”，不会与历史数据合并冒充真实来源。
- `near_location` 在本阶段只保留待核验条件；未接高德前不会按虚构距离排序。

### 团购与线上超市

- 团购、商品和库存均为演示业务数据，不产生真实交易。
- 商品搜索只返回是否有货；只有 `get_product_stock` 返回精确演示库存。
- `950ml` 等商品规格不会被误识别为价格预算。

### 长期偏好

- 匿名用户不能读取或保存长期偏好。
- 只有登录用户明确提出长期记住、参数包含 `consent_confirmed: true` 且偏好值通过对应 Schema 时才写入。
- 读取仅返回已授权范围，不把用户偏好混入公共知识。

## 工具执行与审计

- 工具参数先解析 JSON，再进行严格 Zod 校验和额外字段拒绝。
- 未注册工具由 allowlist 拒绝，并以脱敏参数摘要记录 `queued`、`failed` 状态。
- 已注册工具记录 `queued`、`running` 和最终状态；审计写入失败不破坏已经得到的业务结果，但会向客户端发送明确警告。
- 审计只保存工具名、脱敏参数摘要、耗时、来源、结果数和错误码，不保存密钥、完整 Prompt 或完整敏感文本。

## 用户界面

- 完成态仍保留“小智处理进度”，多工具链可看到每一步公开状态和数据来源。
- 普通用户只看到“正在查询商品”“正在核对商品库存”等公开文案，不看到内部工具名或参数。
- `NEXT_PUBLIC_ENABLE_AI_DEBUG=true` 且请求显式开启 debug 时，才显示工具名、参数摘要、耗时、来源、结果数和错误码。
- 房源、团购和商品卡片使用独立 `result_cards` 事件；精确库存卡会替换同一商品的搜索态卡片。
- 助手消息持久化时同时保存结构化卡片，后续可用于会话恢复。

## 百炼兼容性核对

代码按阿里云百炼当前官方 OpenAI-compatible Function Calling 契约实现：工具使用 JSON Schema，流式 `tool_calls` 按 `index` 拼接 `arguments`，工具结果使用 `role: tool` 和 `tool_call_id` 回传。官方示例也展示了函数级 `strict: true`。参考：

- <https://help.aliyun.com/zh/model-studio/qwen-function-calling>
- <https://help.aliyun.com/zh/model-studio/context-cache>

## 自动验证证据

- `pnpm lint`：通过，0 error、0 warning
- `pnpm typecheck`：通过
- `pnpm test`：44 个测试文件、174 项测试全部通过
- Task 6 固定评测子集：8/8 通过，覆盖房源路由、精确库存、无结果、偏好同意、禁止推断、密钥与 Prompt 防泄露、高德不可用降级
- `pnpm build`：通过，31 个页面完成生产构建
- `pnpm test:e2e`：Chromium 38 项全部通过
- 页面预览：26 个路由模板完成 430px 长截图，聊天页包含公开进度和结构化结果卡

测试覆盖还包括：契约与运行时 Schema 一致、未知字段拒绝、PostgreSQL UUID 兼容、城市与最低租金查询映射、精确库存二次查询、工具去重、一次参数修复、8 轮上限、超时、预先取消、未知工具审计脱敏、审计失败降级、来源卡片、卡片归并和持久化。

## 尚未形成的证据

当前工作环境没有配置 `DASHSCOPE_API_KEY`、Supabase URL、publishable key、service role key 或匿名 Cookie 密钥。因此：

- 没有执行真实千问在线 Function Calling smoke test。
- 没有对用户的真实 2024 房源表执行在线查询。
- 没有在真实 Supabase 中验证 `ai_tool_runs` 写入和用户偏好 RLS。

以上能力具有契约、Adapter 和自动测试证据，但不能宣称云端已经联通。演示 E2E 明确使用确定性工具 Provider 和本地演示仓库，不写云端。

地图与 RAG 不属于本任务：遇到距离、路线或政策问题时会明确说明尚未核验。下一阶段应先接高德工具，再单独实现 Knowledge Service 与引用闭环。
