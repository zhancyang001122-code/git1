# 数据架构

## 领域

### 业务事实
`houses`、`stores`、`deals`、`products`、`product_inventory`、`community_posts`

### 用户
`user_profiles`、`user_preferences`、`favorites`、`cart_items`、`notifications`

### 对话和 AI Ops
`conversation_sessions`、`conversation_messages`、`ai_tool_runs`、`ai_feedback`

### 知识
`kb_articles`、`kb_article_versions`、`kb_chunks`、`knowledge_candidates`、`knowledge_reviews`

### 评测
`ai_eval_cases`、`ai_eval_runs`

## 当前策略

Demo 全部放在一个 Supabase PostgreSQL 项目，降低运维复杂度；代码按 Business、Knowledge、AI Operations、User 模块隔离。物理共库不等于职责混合。

## 一致性

- 页面和小智读取同一业务表。
- 业务价格、库存变化不需要训练模型。
- 知识通过版本和索引任务更新。
- `kb_chunks` 可从版本完全重建。
- 高德 POI 如缓存，必须保存来源和过期时间，不能当永久事实。

## 何时拆分

- 团队独立发布节奏
- 知识索引影响 OLTP
- 合规或地域要求
- 某域独立扩容和 SLA
- 多租户权限差异

演进：
```text
Business Service -> OLTP DB
Knowledge Service -> document store + vector/search
Conversation Service -> append-only/event store
AI Ops -> analytics/evaluation
```

## 数据保留

Demo 默认：
- 对话和工具日志 30 天
- 评测长期保留
- 用户可清除偏好和历史

企业版按隐私、合同、合规配置，并支持删除传播到索引和日志。
