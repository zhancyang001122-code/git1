# RAG Knowledge Service 阶段报告

日期：2026-08-11
分支：`codex/rag-knowledge-service`

## 本阶段结果

- 建立独立 `KnowledgeService`，UI 和 Agent 不接触 `pgvector` 表结构。
- 查询经过 Zod 校验、白名单元数据规划、1024 维 Embedding、Supabase 混合召回和可选 Rerank。
- 数据库和应用层双重过滤：只允许 published、当前生效且属于 current version 的知识。
- 最终结果包含 article/version/chunk、版本、生效日期、摘录、分数和 Demo 标识。
- 无结果、低置信或冲突时不得强答；正式模式会将脱敏问题写入待审核候选，不会直接发布知识。
- 索引支持确定性分块、批量 Embedding、内容哈希、幂等跳过、失败标记和旧分块清理。
- 新增受 Bearer Token 保护的索引 API；索引操作不会替代人工发布流程。
- 小智已注册 `search_knowledge`，引用通过 SSE 传到聊天 UI 并随对话持久化。

## 关键工程判断

1. 价格、库存、房源状态继续走结构化业务工具，RAG 只处理政策和说明。
2. 数据库过滤不是唯一防线，Knowledge Service 会再次检查版本和生效期。
3. Rerank 失败回退到混合排序；Embedding、数据库或参数错误不会静默切换成伪造结果。
4. 文档变短时必须删除旧索引分块，否则用户可能命中过期段落。
5. 知识缺口只进入候选队列，候选需要人工审核、发布、索引和回归评测后才可检索。

## 验证证据

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：64 个测试文件、247 条测试全部通过。
- `pnpm build`：通过，知识 search/index 路由进入生产构建。
- `pnpm db:check`：11 个迁移、26 张表及全部 RLS 覆盖通过。
- `pnpm test:e2e`：40 条 Chromium E2E 全部通过。
- RAG 评测：10 条可执行案例，覆盖退款、宠物、押金、配送、隐私和无依据拒答。

## 仍未验证的真实外部状态

- 本阶段没有把迁移应用到远程 Supabase，也没有声称线上数据库已更新。
- 没有使用真实百炼 Key 调用 `text-embedding-v4` 或 `qwen3-rerank`；当前验证来自契约测试和官方接口格式。
- 公网生产环境还需要网关级分布式限流、监控告警和真实数据回归评测。

## 面试时应能解释

- 为什么结构化数据不能用 RAG 替代。
- 为什么要同时做数据库过滤和应用层复核。
- Embedding、混合召回、Rerank 分别解决什么问题。
- 为什么低置信、冲突和无结果必须拒绝确定性回答。
- 内容哈希如何让索引重试幂等，旧分块为什么必须清理。
- 用户纠正为什么只能形成候选，不能直接写成 published 知识。
