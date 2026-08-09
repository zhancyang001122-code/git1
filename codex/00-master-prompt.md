# Codex 总提示词

你正在从一个只包含规格文件的仓库创建“小智——本地生活 AI 服务助手”。应用代码必须创建在根目录 `web/`，不得覆盖 `docs/`、`design/`、`contracts/`、`config/`、`supabase/`、`qa/` 或 `codex/`。

## 开始前必须阅读

1. 根目录 `AGENTS.md`
2. `docs/01-PRD.md`
3. `docs/03-ui-design-system.md`
4. `docs/04-page-specifications.md`
5. `docs/05-ai-agent-architecture.md`
6. `docs/06-rag-knowledge-system.md`
7. `docs/07-data-architecture.md`
8. `contracts/tool-contracts.json`
9. `contracts/qwen-system-prompt.md`
10. `docs/superpowers/plans/2026-08-05-xiaozhi-implementation.md`

原型图位于 `design/prototypes/`。它们只定义页面内容和视觉方向；尺寸冲突时必须遵守设计 tokens 和页面规格。

## 锁定技术栈

- Next.js App Router、TypeScript、Tailwind CSS
- pnpm、Node.js 22+
- Supabase PostgreSQL、RLS、pgvector
- 阿里云百炼通义千问，北京地域，OpenAI 兼容 Chat Completions + Function Calling
- `text-embedding-v4`，1024 维
- 可选 `qwen3-rerank`
- 高德 Web 服务 API
- Vitest + Testing Library + Playwright
- Vercel，Root Directory `web/`

## 工作方式

- 严格一次只执行实施计划中的一个 Task；完成测试、lint、typecheck、build 和该 Task 的验收后停下汇报。
- 先写失败测试，再写最小实现，再重构。
- 不安装 LangChain、LangGraph、第二个向量数据库或完整 UI 框架，除非规格变更明确批准。
- 不用大文件复制粘贴页面。先实现 tokens、AppShell、导航和公共组件，再组装页面。
- 所有外部服务必须通过接口适配器，可在测试中替换 fake。
- 不因密钥缺失阻塞前端：`NEXT_PUBLIC_DEMO_MODE=true` 时启用明确标注的本地 fallback；配置齐全时使用真实 Supabase/Qwen/AMap。
- 不伪造服务成功。健康页和 UI 必须显示当前是 real、demo fallback 还是 unavailable。
- 不在客户端代码、日志、错误响应或测试快照中暴露服务端密钥。
- 所有数据和工具响应先通过 Zod/contract 校验。

## 完成汇报格式

```text
Task: <编号和名称>
Changed: <关键文件>
Verification:
- <命令>: PASS/FAIL
Behavior checked: <手工或自动验收>
Known gaps: <仅限后续 Task 明确覆盖的内容>
Next task: <下一编号，不执行>
```

第一轮只执行 Task 1。不要一次生成完整项目。
