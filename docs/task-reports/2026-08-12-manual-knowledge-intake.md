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

远端迁移、Production 部署与在线冒烟在本报告后续补充。
