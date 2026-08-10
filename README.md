# 小智｜本地生活 AI 服务助手

面向 AI FDE / Solutions Engineer 面试的移动端 Web 作品集。产品以微信小程序式 430px 画布演示，将结构化业务查询、地图工具、可追溯 RAG、多工具编排和受控知识运营闭环组合在同一套 Agent 架构中。

## 当前真实状态

- 五个主页面、业务二级页、流式对话、工具进度、反馈与知识运营页面已经实现。
- 当前默认运行在明确标注的 Demo 模式；可选启动本机房源 API，让武林广场附近查询使用 2024-11 真实历史快照。未配置时房源仍为确定性 Demo。
- 尚未连接远程 Supabase、阿里云百炼千问或高德 Web Service，也没有用户提供的正式客服知识材料。
- 代码已预留 Live Adapter、RLS 迁移、1024 维 RAG、超时、限流、熔断、日志脱敏和评测边界；外部配置完成前不会宣称生产可用。
- 不创建发布标签，直到真实部署、迁移、Embedding 和线上冒烟全部通过。

## 技术栈

- Next.js App Router、React、TypeScript strict、Tailwind CSS
- Supabase PostgreSQL、RLS、pgvector
- 百炼 OpenAI 兼容 API、Function Calling、Embedding、Rerank
- 高德 Web Service API
- Zod、Vitest、Testing Library、Playwright
- Python、FastAPI、Pydantic、SQLite R-Tree（本机历史房源服务）
- pnpm、Vercel

## 快速开始

```powershell
cd web
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

保持 `NEXT_PUBLIC_DEMO_MODE=true` 即可运行不依赖外部账号的作品集 Demo。知识管理页还需要在 `.env.local` 设置至少 32 位的 `DEMO_ADMIN_TOKEN`。

若要让小智查询本机 2024-11 真实历史房源，先按 [房源 API 说明](services/housing-api/README.md) 启动服务，再在 `web/.env.local` 同时配置 `HOUSING_API_BASE_URL` 与 `HOUSING_API_KEY`。该能力仍是历史数据，不代表当前可租。

完整质量门：

```powershell
pnpm lint
pnpm typecheck
pnpm test
$env:PLAYWRIGHT_PORT='3310'; pnpm test:e2e
pnpm build
```

## 关键文档

- [应用说明](web/README.md)
- [三分钟演示脚本](qa/demo-script.md)
- [部署手册](web/docs/deployment.md)
- [故障运行手册](web/docs/runbook.md)
- [配置与账号接入](docs/14-configuration-guide.md)
- [知识库材料准备清单](docs/15-knowledge-material-intake.md)
- [验收标准](docs/11-acceptance-criteria.md)
- [Task 10 知识闭环报告](docs/task-reports/2026-08-11-task-10-governed-knowledge-loop.md)
- [Task 11 安全加固报告](docs/task-reports/2026-08-11-task-11-service-hardening.md)
- [本机历史房源接入报告](docs/task-reports/2026-08-11-housing-http-integration.md)

Vercel Root Directory 固定为 `web/`。
