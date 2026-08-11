# Live 知识反馈与运营持久化报告

## 目标

把此前只在 Demo 内存中工作的反馈和知识运营流程接入 Supabase，同时保持“没有千问就不允许半发布”的真实性边界。

## 已完成

- 匿名反馈通过签名 HttpOnly Cookie、会话归属和用户消息角色三层校验。
- `ai_feedback` 按 `message_id` 幂等写入，支持匿名会话的 `user_id = null`。
- 点踩可生成持久化知识候选，并支持草稿、审核、发布准备、发布结果和回滚记录。
- 所有知识运营写操作只通过 service role 可执行的 `security definer` RPC；浏览器和普通用户无直接权限。
- 没有 `DASHSCOPE_API_KEY` 时，列表、草稿和审核仍可用；发布在创建文章或版本前返回 `KNOWLEDGE_INDEXING_NOT_CONFIGURED`。
- 增加服务端专用可选 `SUPABASE_URL`，避免管理流量被构建时固化的浏览器公开 URL 绑死。
- 增加 `pnpm feedback:verify-local`，自动启动隔离的本地 Live 服务，写入并核对反馈与候选后清理测试数据。

## 远端发布

- Supabase 项目：`zaneyang1`
- Project ref：`paetpneqyherfwutisdj`
- Region：`ap-northeast-1`
- dry-run：只包含 `202608120015_live_knowledge_ops.sql`
- 正式应用后：本地与远端 `202608050001` 至 `202608120015` 全部一致
- 使用本机 Live API 连接远端 Supabase 完成一次唯一问题的反馈与候选冒烟，结果通过并清理临时记录

## 验证证据

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：108 个文件、394 个测试通过
- `pnpm build`：通过
- `pnpm db:check`：15 个迁移、28 张表均启用 RLS
- `pnpm db:test`：3 个 pgTAP 文件、65 个断言通过（含双版本发布与回滚）
- `pnpm db:verify-rls`：17 个角色边界检查通过
- `pnpm db:verify-http`：14 个 PostgREST 边界检查通过
- `pnpm feedback:verify-local`：真实本地 API → 本地 Supabase 通过
- `$env:PLAYWRIGHT_PORT='3310'; pnpm test:e2e`：47 项通过，2 项需专项环境而跳过
- 远端 Live 反馈冒烟：真实本机 API → 远端 Supabase 通过

## 尚未完成

- 尚无正式知识材料，不能宣称真实 RAG 内容质量已验证。
- 尚未配置百炼 Key，线上 Embedding、检索与评测未验证。
- 高德、生产 SMTP 和作者邮箱 OTP 仍待用户提供账号侧配置。
- Vercel 生产环境继续保持明确 Demo 状态，不能因为数据库链路已完成就宣称整个产品已经 Live。
