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

## 可靠性

- 外部调用超时、有限重试、错误归一化。
- 高德失败可降级为已有坐标/直线距离，但必须说明。
- 千问失败保留用户消息并支持重试。
- Supabase 失败显示错误，不隐蔽切换为另一套数据。
- Embedding 异步重试；新索引失败不影响旧发布版本。

## 可观测性

每个请求生成 `traceId`，贯穿：

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

## 企业告警

- 工具失败率 > 5%
- RAG 无结果率异常
- 首 token P95 > 6s
- 单会话成本超阈值
- embedding 队列积压
- 发布后回归失败
