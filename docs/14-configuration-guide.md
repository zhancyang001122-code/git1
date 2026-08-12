# 配置与账号接入指南

## 1. 本地基础环境

安装 Node.js 22+ 和 pnpm 10：

```bash
corepack enable
corepack prepare pnpm@10 --activate
node --version
pnpm --version
```

从规格包根目录运行 `./scripts/bootstrap-project.sh`，或让 Codex执行 Task 1。复制 `web/.env.example` 为 `web/.env.local`，真实密钥只写入 `.env.local` 和 Vercel 环境变量。

## 2. Supabase

1. 创建 Supabase 项目，记录 Project URL 和 publishable key。
2. 在项目设置中取得新版 secret key（`sb_secret_`），仅用于服务端；不要在新部署中使用旧版 service_role JWT。
3. 使用 Supabase CLI link 项目，按顺序应用根目录 `supabase/migrations/`。
4. 验证业务种子、知识文章和评测案例存在。
5. 用 publishable key 验证可读业务数据、不可写业务表和 AI Ops；用测试用户验证自己的偏好可读写、跨用户不可读。
6. 将 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 和 `SUPABASE_SECRET_KEY` 配置到本地/部署环境。需要让服务端管理流量使用独立地址时，可额外设置 `SUPABASE_URL`；未设置时兼容使用公开 URL。

RAG embedding 列固定为 1024 维。改模型维度必须创建新迁移、重建 `kb_chunks.embedding` 和索引，不能只改环境变量。

## 3. 阿里云百炼通义千问

1. 控制台地域选择华北 2（北京）。
2. 创建业务空间和同地域 API Key。
3. 开通可用的千问文本、`text-embedding-v4` 和需要时的 `qwen3-rerank`。
4. 配置：

```env
DASHSCOPE_API_KEY=<server-only>
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4
DASHSCOPE_EMBEDDING_DIMENSIONS=1024
DASHSCOPE_RERANK_MODEL=qwen3-rerank
DASHSCOPE_RERANK_BASE_URL=<工作空间专属 compatible-api/v1 地址>
# 可选，以下五项必须同时配置；价格变化后要更新核验日和分档。
DASHSCOPE_PRICING_MODEL=qwen-plus
DASHSCOPE_PRICING_MODE_LABEL=非思考模式
DASHSCOPE_PRICING_EFFECTIVE_FROM=2026-08-12
DASHSCOPE_PRICING_SOURCE_URL=https://help.aliyun.com/zh/model-studio/qwen-plus
DASHSCOPE_PRICING_TIERS_JSON=[{"maxInputTokens":128000,"inputCnyPerMillion":0.8,"outputCnyPerMillion":2},{"maxInputTokens":256000,"inputCnyPerMillion":2.4,"outputCnyPerMillion":20},{"maxInputTokens":1000000,"inputCnyPerMillion":4.8,"outputCnyPerMillion":48}]
RAG_RERANK_ENABLED=false
RAG_VECTOR_WEIGHT=0.65
RAG_TEXT_WEIGHT=0.35
RAG_LOW_CONFIDENCE_THRESHOLD=0.45
RAG_TOP_K=12
RAG_FINAL_K=5
```

模型名通过环境变量可替换。首次接入先用百炼控制台当前模型清单验证模型可用；API Key、地域 Host 和业务空间必须匹配。不要把 Key 写成 `NEXT_PUBLIC_*`。

成本配置引用 [`qwen-plus` 官方价格页](https://help.aliyun.com/zh/model-studio/qwen-plus)，当前按中国内地（北京）非思考模式公开原价配置。系统先由 service-role 专用 RPC 按每条 assistant 消息的 `model_name + input_tokens + output_tokens` 分桶，再按该请求的输入长度选择价格档位；不能把 7 天总 Token 全部套入最低档。管理页同时显示请求覆盖率，其他模型、缺失 Token 或超出已配置档位的请求保持未计价。该值不含免费额度、优惠、Embedding 和 Rerank，仅是可复核估算，不是阿里云账单；Embedding 的官方响应虽含 `usage.prompt_tokens`，当前项目尚未持久化该字段，不能把它假装计入。

配置 Key 后运行 `pnpm external:verify-qwen`，该命令会以最小调用验证流式文本、流式 Function Calling 和 `text-embedding-v4` 的 1024 维输出，不打印 Key。

## 4. 高德开放平台

1. 创建 Web 服务应用和 Key，不是浏览器 JS Key。
2. 在服务端配置 `AMAP_WEB_SERVICE_KEY`。
3. 开发期验证地理编码、周边 POI 和步行路线接口。
4. 浏览器定位只返回经纬度给自己的 `/api/chat` 或地图 route；高德 Key 不下发。
5. 记录配额和错误码，CI 使用 fixtures，不调用真实接口。

默认演示地点：杭州武林广场，坐标仅用于 fallback。用户拒绝定位时 UI 必须说明使用默认地点。

配置 Web 服务 Key 后运行 `pnpm external:verify-amap`，依次验证武林广场地理编码、2 公里内超市 POI 和到首个结果的步行路线，不打印 Key。

## 5. RAG 初始化

种子迁移会创建 published 文章、版本和 pending chunks。应用实现 indexing 后：

1. 选择当前 published version。
2. 规范化 Markdown 并生成确定性 chunks。
3. 调用 `text-embedding-v4` 生成 1024 维向量。
4. 更新 embedding、model、embedded_at 和状态。
5. 运行 RAG eval，确认退款、押金、配送、隐私和拒答案例。

`RAG_RERANK_ENABLED=false` 时使用混合融合排序；验证 rerank 模型和预算后再启用。

索引入口为 `POST /api/knowledge/index`，请求体只接受 `versionId`，并要求 `Authorization: Bearer <DEMO_ADMIN_TOKEN>`。Token 必须是至少 32 位的随机值，只能放在服务端环境变量或请求头中，禁止放入 URL、浏览器代码或日志。该入口只建立索引，不负责发布知识版本。

`POST /api/knowledge/search` 提供经过 Zod 校验的服务端检索边界，请求体最大 8 KiB，单次最多返回 8 条结果。Production 与 Chat、Feedback 一样使用 Supabase 原子共享限流；客户端标识先用 `ANONYMOUS_COOKIE_SECRET` 执行 HMAC-SHA256，数据库不保存原始 IP。共享计数后端异常时接口失败关闭为 503。该方案适合当前低流量作品集；面向公众高流量时仍应评估边缘 WAF、套餐配额和专用 Redis/Upstash。

## 6. Vercel

1. 导入代码仓库，Root Directory 设置为 `web/`。
2. Node.js 设置为 22。
3. 分别配置 Preview 和 Production 环境变量。
4. 部署前完成 Supabase migrations 和 embedding。
5. 部署后访问 `/api/health`，再运行 staging/live smoke tests。
6. 生成二维码并准备本地录屏备份。

Production 切到 Live 后，在 `web/` 运行：

```powershell
$env:EXPECTED_PRODUCTION_MODE='live'
pnpm deploy:verify-production
```

该检查要求 Supabase、历史房源、千问和高德都报告 `configured`，并通过“历史房源 + 高德”和“演示商品 + 偏好提案”两条真实多工具对话、来源标识、偏好取消零写入及反馈持久化。它会产生两条测试对话和一条点赞反馈，不应用于高频监控。

Preview 默认不复用 Production 数据库和服务端密钥；未配置独立 staging 后端时保持明确的 Demo 模式。对受 Vercel Authentication 保护的 Preview，可在当前 PowerShell 进程中临时设置自动化 bypass，再运行同一验证器：

```powershell
$env:DEPLOYMENT_URL='https://your-preview.vercel.app'
$env:EXPECTED_DEPLOYMENT_MODE='demo'
$env:VERCEL_AUTOMATION_BYPASS_SECRET='<仅放在当前进程，不写入文件>'
pnpm deploy:verify
```

验证器只通过请求头使用 bypass；禁止把它写进 URL、Git 或日志。没有独立 Supabase staging 项目前，不得把 Demo Preview 描述成 Live staging。

## 7. Demo 与真实模式

```env
NEXT_PUBLIC_DEMO_MODE=true
```

用于前端/fixture 演示，UI 显示 fallback。配置真实服务并验证后设为 `false`。不能在真实服务失败时无提示切到 Mock；响应和页面必须显示当前数据来源。

## 8. 密钥清单

浏览器允许：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 非敏感 UI 开关和默认地点

服务端专用：

- `SUPABASE_SECRET_KEY`（优先，新版 `sb_secret_`）
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`（可选，仅覆盖服务端管理流量地址）
- `DASHSCOPE_API_KEY`
- `AMAP_WEB_SERVICE_KEY`
- `DEMO_ADMIN_TOKEN`

泄漏后立即撤销/轮换，不只从 Git 删除历史文件。
