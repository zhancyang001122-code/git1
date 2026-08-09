# Codex 交接说明

## 直接使用

1. 解压 ZIP 到一个空的工作目录。
2. 在该目录打开 Codex。
3. 第一条消息复制：

```text
请先完整阅读根目录 AGENTS.md、codex/00-master-prompt.md、docs/01-PRD.md 和 docs/superpowers/plans/2026-08-05-xiaozhi-implementation.md。严格按阶段执行，只完成 Task 1，完成后运行验收命令并汇报，不要跳到后续阶段。
```

4. Codex 完成并汇报 Task 1 后，人工检查验证输出，再按 `codex/execution-order.md` 发送下一阶段。

## 不要一次要求 Codex“把整个项目全部写完”

本项目包含完整页面、数据层、Agent、地图、RAG 和知识运营。一次性生成会导致组件重复、接口漂移、工具和数据库不一致，也无法验证。实施计划的每个 Task 都产生可运行、可审核的增量。

## Codex 应先使用哪些文件

- 目标和范围：`docs/01-PRD.md`
- 页面和原型：`docs/03-ui-design-system.md`、`docs/04-page-specifications.md`、`design/prototypes/`
- Agent/RAG：`docs/05-ai-agent-architecture.md`、`docs/06-rag-knowledge-system.md`
- 精确工具/API：`contracts/`
- 数据库：`supabase/migrations/`
- 实施步骤：`docs/superpowers/plans/2026-08-05-xiaozhi-implementation.md`
- 阶段提示词：`codex/`
- 验收：`qa/`、`docs/11-acceptance-criteria.md`

## 人工需要提供给 Codex 的信息

开发到对应阶段时再提供，不要写进聊天截图或提交：

- Supabase Project URL、publishable key、service role key
- 百炼北京地域 API Key
- 高德 Web Service Key
- Vercel 项目和环境变量权限

Codex 在没有密钥时必须继续完成 fake/fixture 和 demo mode，不应伪造外部服务已接通。
