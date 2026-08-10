# 小智 Web 应用

这是“小智”作品集的 Next.js 应用，Vercel 部署时将本目录设为 Root Directory。

## 产品能力

- 430px 微信小程序式移动端界面，五个主页面共享统一导航和设计 Token。
- 房源、团购、商品、库存、周边地点与路线的结构化工具查询。
- 服务端 SSE 对话，展示公开处理进度、类型化结果卡、来源标签和知识引用。
- RAG 混合检索、可选 Rerank、文章/版本/切片分层以及低置信拒答。
- 用户反馈形成候选知识，经过草稿、人工审核、发布、索引、评测和可用时回滚。
- requestId、日志脱敏、请求体上限、限流、超时、幂等重试和共享熔断。

## 本地运行

要求 Node.js 22+、pnpm 10。

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

访问 `http://127.0.0.1:3000`。默认 Demo 不调用外部服务；管理入口需要配置至少 32 位的 `DEMO_ADMIN_TOKEN`。

## 质量命令

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
$env:PLAYWRIGHT_PORT='3310'; pnpm test:e2e
```

数据库静态检查：

```powershell
pnpm db:check
pnpm db:verify-rls
```

`db:verify-http` 需要已配置的 Supabase 测试项目。

## 架构边界

```text
UI
  -> application services
      -> business / maps / knowledge / user ports
          -> Supabase / AMap / Qwen adapters
```

React 页面不直接执行 SQL，不使用 service role 客户端。价格、库存、状态、政策、生效日期和距离必须来自对应工具；工具没有结果时明确降级，不允许模型补造。

## Demo 与 Live

`NEXT_PUBLIC_DEMO_MODE=true`：使用确定性演示数据，UI 显示 Demo 来源，不写远程数据。

`NEXT_PUBLIC_DEMO_MODE=false`：要求完整配置 Supabase、百炼、高德、匿名 Cookie 密钥和管理口令。当前知识运营 Live Runtime 仍保持关闭，需在真实知识材料和数据库发布链完成后才能启用。

详细步骤见 [deployment.md](docs/deployment.md) 与 [runbook.md](docs/runbook.md)。
