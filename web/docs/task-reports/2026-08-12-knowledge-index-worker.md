# 独立知识索引 Worker 验证记录

## 结论

2026-08-12 已完成并在线验证持久化知识索引队列。Production 部署 `dpl_CuGA3PAXNqTciDXdcSxDoeWk4Khq` 已别名到 `https://xiaozhi-local-life.vercel.app`。

这次验证证明“发布 → 持久化入队 → 独立 Worker → 百炼 Embedding → Supabase 写入 → 混合检索引用”技术链路可运行。验证材料是仓库中四个 `is_demo=true` 的演示政策，不是用户正式客服资料，因此不勾选“正式知识材料检索与评测”。

## 架构证据

- `publish_knowledge_candidate()` 在一个数据库事务内发布版本并调用 `enqueue_knowledge_index_job()`，不存在“已发布但未入队”的网络中断窗口。
- `knowledge_index_jobs.version_id` 唯一，重复入队幂等；终态失败只有被明确再次 enqueue 时才重置。
- `claim_knowledge_index_job()` 使用 `FOR UPDATE SKIP LOCKED`、Worker UUID 与最长 55 秒租约，多实例不会重复领取同一任务。
- Worker 对可重试错误按 10/20/40 秒退避，默认最多尝试 3 次；索引实现继续使用 chunk hash 保证重跑安全。
- `/api/internal/knowledge-index-worker` 只接受 `CRON_SECRET` Bearer 或签名管理 Cookie；无凭证线上返回 HTTP 401。
- Vercel Hobby 每日 Cron 是兜底调度；管理页可在面试现场即时处理一个任务，UI 在 Worker 成功前始终显示 `queued/不可检索`。

## 自动化证据

- `pnpm db:check`：19 个迁移、29 张表的 RLS 静态校验通过。
- `pnpm db:test`：3 个 pgTAP 文件共 80 项通过，覆盖原子入队、领取、租约、重试、完成与幂等。
- `pnpm db:verify-rls`：17 项角色边界通过。
- `pnpm db:verify-http`：14 项 PostgREST/JWT 边界通过。
- `pnpm test`：113 个 Vitest 文件、423 项测试通过（部署前基线；最终提交前再次执行）。
- `pnpm test:e2e`：47 项通过，2 项条件跳过。
- `pnpm deploy:verify`：Production Live 健康、移动布局、房源、高德、商业数据、偏好提案与反馈流通过。
- `pnpm knowledge:verify-worker`：四次 Worker 均返回 `succeeded`，四个 Demo 版本均写入真实 `text-embedding-v4` 结果。

## 在线检索证据

对“团购券在有效期内且未使用，可以退款吗？”执行 Production 检索：

- HTTP 200
- chunks：1
- citations：1
- 首条来源：`团购券退款规则` / `v1.0`
- `isDemo=true`
- `lowConfidence=false`
- `conflict=false`

## 线上发现并修复的问题

1. PostgreSQL 接受固定测试 UUID 的标准 128 位文本格式，但 Zod `.uuid()` 还校验 RFC 版本位，导致版本位为 `0000` 的种子 ID 被误拒。数据库边界已统一改用 PostgreSQL UUID 格式校验，并加入真实种子 ID 回归测试。
2. `kb_article_versions` 与 `kb_articles` 存在“所属文章”和“当前版本”两条外键，PostgREST 嵌套查询需要显式指定 `kb_article_versions_article_id_fkey`。查询与测试均已固定该关系。

## 未完成边界

- 用户尚未提供正式知识材料，不能宣称正式 RAG 内容验收完成。
- Production 管理口令尚未配置，管理页在线登录验收仍未完成；`CRON_SECRET` 已配置且不向用户或浏览器公开。
- `qwen3-rerank` 仍缺百炼 Workspace 专属 URL，在线重排未验证。
