# 人工知识材料受控录入报告

## 目标

在用户提供正式资料之前补齐安全导入入口，使后续材料不需要手改数据库，同时不绕过既有的候选、审核、发布、索引和评测治理链路。

## 实现

- 受保护的 `/knowledge-admin` 增加移动端结构化材料录入表单。
- 必填：代表问题、标题、正文、来源、负责人、领域、分类、版本号、生效日期和变更说明；失效日期可选且不能早于生效日期。
- `POST /api/knowledge/candidates` 新增 `action=create_draft`，由 Zod 严格校验输入。
- application service 只调用 Repository；React 页面不访问 Supabase。
- Supabase 使用 `create_knowledge_candidate_draft(text, jsonb)` 在单个事务中创建或去重候选并保存草稿。
- RPC 只授予 `service_role`；`anon` 和 `authenticated` 均无执行权限。
- 导入结果固定为 `drafted`，不会自动发布、生成 Embedding 或进入检索。
- 正式版本发布时保留用户填写的 `versionLabel` 与可选 `effectiveUntil`；旧草稿未填写时继续使用系统递增版本号，保持向后兼容。

## 当前边界

- 这是结构化文本录入，不是 Word/PDF 自动解析器。
- 正式材料仍需用户提供并确认来源、公开授权与脱敏结果。
- 没有正式材料和评测问题前，不勾选正式 RAG 检索、引用或质量评测验收项。

## 本地验证

- 定向 Vitest：材料 API、Schema、Repository 和管理页交互均通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm format:check`：通过。
- `pnpm test`：124 个文件、497 个测试通过。
- `pnpm build`：通过。
- `pnpm db:check`：26 个迁移、33 张表 RLS 覆盖通过。
- 从零重建本地数据库后，`pnpm db:test`：9 个 pgTAP 文件、200 个断言通过。
- `pnpm test:e2e`：48 项通过，2 项按专项环境跳过；360/390/430px 移动端画布均无水平溢出。

## 远端与 Production 证据

- Supabase dry-run 只包含 `202608120026_manual_knowledge_intake.sql`，随后正式应用成功；迁移历史显示本地与远端 `202608050001` 至 `202608120026` 全部一致。
- linked `knowledge_ops_live.test.sql`：51/51 通过，覆盖新 RPC 的 service-role 专用权限、草稿状态、版本号保留，以及既有发布、索引队列和回滚流程。
- Vercel Production deployment：`dpl_9ktWPtBEep1qT7ZoVTsM7gXKuW6R`，状态 `READY`，别名为 `https://xiaozhi-local-life.vercel.app`。
- `pnpm deploy:verify-production`：Live 健康检查、移动端布局、房源、高德、演示商业数据、偏好提案和反馈链路通过。
- `pnpm deploy:verify-knowledge-intake`：使用真实 Production 管理会话录入唯一临时材料，持久化结果为 `drafted`，保留 `smoke-v1`，匿名不可读且不可检索；脚本随后按唯一 ID 删除并复查无残留。
