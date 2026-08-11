# 安全、可靠性与可观测性

## 安全

- 百炼、高德、service role Key 仅服务端。
- API、工具和外部响应使用 Zod。
- 所有表启用 RLS。
- 公共内容匿名只读；用户数据 owner 隔离；AI Ops 服务端访问。
- 搜索词、半径、分页、排序字段白名单。
- 知识文档不能改变系统权限，防止 Prompt Injection。
- 日志最小化并脱敏。
- Demo Admin 用独立 token；生产改为 RBAC/SSO。
- 日志按字段递归过滤 key/token/authorization/cookie/password/service role、手机号和精确地址；不依赖开发者手工记得打码。
- Chat、Feedback、发布和索引接口使用单实例固定窗口限流，客户端标识先哈希再存储。Vercel 多实例生产环境必须替换为 Redis/Upstash 等共享限流存储。
- JSON 请求在解析前检查声明长度和实际 UTF-8 字节数；聊天最大请求体 16 KiB，反馈 8 KiB，管理发布/索引 4 KiB。

## 可靠性

- 外部调用超时、有限重试、错误归一化。
- 高德 GET、Embedding 和 Rerank 只对可重试故障重试一次，并带抖动；鉴权、校验和用户取消不重试。千问生成不是幂等操作，不自动重试，只做超时、错误归一化和熔断。
- 外部适配器使用进程级共享熔断器，连续 3 次可重试故障后短路 30 秒；Serverless 多实例之间不共享熔断状态。
- 高德失败可降级为已有坐标/直线距离，但必须说明。
- 千问失败保留用户消息并支持重试。
- Supabase 失败显示错误，不隐蔽切换为另一套数据。
- Embedding 异步重试；新索引失败不影响旧发布版本。

## 可观测性

每个请求生成或接受经 UUID 校验的 `requestId`，贯穿：

```text
chat -> model -> tool -> external API -> response
```

记录：

- route/status/duration
- conversation/tool/result count
- model/token/tool rounds
- RAG candidates/top score/source versions
- errorCode/retryCount

禁止记录密钥、完整系统 Prompt、未脱敏隐私。

当前实现提供进程内聚合耗时指标、JSON 结构化日志，以及由 Supabase `get_ai_ops_dashboard`、`get_rag_ops_trend` 和 `get_ai_model_usage` RPC 生成的持久化汇总。RPC 只向 `service_role` 授权，受保护的知识运营页展示 Token、终态工具失败率、反馈、评测、知识库存、按北京时间补零的 RAG 日趋势，以及逐请求分档的 `qwen-plus` 公开原价估算，不读取原始对话。成本同时显示覆盖率、价格核验日和排除项，不冒充账单。跨实例日志检索和主动告警仍需接入托管可观测平台，不能把现有汇总描述成完整生产监控。

## 企业告警

- 工具失败率 > 5%
- RAG 无结果率异常
- 首 token P95 > 6s
- 单会话成本超阈值
- embedding 队列积压
- 发布后回归失败
