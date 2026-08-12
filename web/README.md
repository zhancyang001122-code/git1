# 小智 Web 应用

这是“小智”作品集的 Next.js 应用，Vercel 部署时将本目录设为 Root Directory。

Production Live：[https://xiaozhi.zaneyang.xyz](https://xiaozhi.zaneyang.xyz)

## 产品能力

- 430px 微信小程序式移动端界面，五个主页面共享统一导航和设计 Token。
- 房源、团购、商品、库存、周边地点与路线的结构化工具查询。
- 服务端 SSE 对话，展示公开处理进度、类型化结果卡、来源标签和知识引用。
- RAG 混合检索、可选 Rerank、文章/版本/切片分层以及低置信拒答。
- 用户反馈形成候选知识，经过草稿、人工审核、发布、索引、评测和可用时回滚。
- requestId、日志脱敏、请求体上限、限流、超时、幂等重试和进程级共享熔断（非跨实例）。
- 持久化索引队列、独立 Worker、租约与退避重试，以及受保护的 RAG/AI Ops 质量视图。
- Supabase 跨实例工具审计检索与站内阈值告警；不返回工具载荷，尚不包含外部通知和值班升级。
- Chat、Feedback、公开知识检索、地图直连和受保护的知识评测使用 Supabase 原子共享限流；只持久化 HMAC 客户端摘要，不保存原始 IP。

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
pnpm feedback:verify-local
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

`NEXT_PUBLIC_DEMO_MODE=false`：Supabase、匿名 Cookie 密钥和管理口令可先启用持久化会话、反馈、候选、草稿与审核。没有百炼 Key 时，发布会在任何数据库变更前明确返回 `KNOWLEDGE_INDEXING_NOT_CONFIGURED`；配置百炼后才允许发布、索引和评测。高德能力缺 Key 时同样明确显示未配置，不会伪装为在线结果。

当前 Production 已接通 Supabase、千问、高德和 2024 历史房源，并通过“历史房源 + 高德”“演示商品 + 偏好提案”两条 Live 回归。公开固定演示码 Auth 已通过真实 Supabase Session、RLS 偏好、退出、重登和清理验收。四份作品集首方公开资料已通过受控发布、独立 Worker、真实 Embedding、在线检索和版本化引用，固定评测 20/20 通过，其中 4/4 千问自然问法用例通过强制取证与严格引用范围检查。企业客服知识材料与 qwen3-rerank 仍未验收，不能从“作品集首方 RAG 已完成”推导为“真实企业知识库已交付”。

部署后回归：

```powershell
$env:EXPECTED_PRODUCTION_MODE='live'
pnpm deploy:verify-production
```

详细步骤见 [deployment.md](docs/deployment.md) 与 [runbook.md](docs/runbook.md)。
