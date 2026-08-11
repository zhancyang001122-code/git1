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
6. 将 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 和 `SUPABASE_SECRET_KEY` 配置到本地/部署环境。

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
RAG_RERANK_ENABLED=false
RAG_VECTOR_WEIGHT=0.65
RAG_TEXT_WEIGHT=0.35
RAG_LOW_CONFIDENCE_THRESHOLD=0.45
RAG_TOP_K=12
RAG_FINAL_K=5
```

模型名通过环境变量可替换。首次接入先用百炼控制台当前模型清单验证模型可用；API Key、地域 Host 和业务空间必须匹配。不要把 Key 写成 `NEXT_PUBLIC_*`。

## 4. 高德开放平台

1. 创建 Web 服务应用和 Key，不是浏览器 JS Key。
2. 在服务端配置 `AMAP_WEB_SERVICE_KEY`。
3. 开发期验证地理编码、周边 POI 和步行路线接口。
4. 浏览器定位只返回经纬度给自己的 `/api/chat` 或地图 route；高德 Key 不下发。
5. 记录配额和错误码，CI 使用 fixtures，不调用真实接口。

默认演示地点：杭州武林广场，坐标仅用于 fallback。用户拒绝定位时 UI 必须说明使用默认地点。

## 5. RAG 初始化

种子迁移会创建 published 文章、版本和 pending chunks。应用实现 indexing 后：

1. 选择当前 published version。
2. 规范化 Markdown 并生成确定性 chunks。
3. 调用 `text-embedding-v4` 生成 1024 维向量。
4. 更新 embedding、model、embedded_at 和状态。
5. 运行 RAG eval，确认退款、宠物、押金、配送和拒答案例。

`RAG_RERANK_ENABLED=false` 时使用混合融合排序；验证 rerank 模型和预算后再启用。

索引入口为 `POST /api/knowledge/index`，请求体只接受 `versionId`，并要求 `Authorization: Bearer <DEMO_ADMIN_TOKEN>`。Token 必须是至少 32 位的随机值，只能放在服务端环境变量或请求头中，禁止放入 URL、浏览器代码或日志。该入口只建立索引，不负责发布知识版本。

`POST /api/knowledge/search` 提供经过 Zod 校验的服务端检索边界，单次最多返回 8 条结果。正式公网部署仍需在网关增加分布式限流和滥用防护，不能依赖单实例内存计数器。

## 6. Vercel

1. 导入代码仓库，Root Directory 设置为 `web/`。
2. Node.js 设置为 22。
3. 分别配置 Preview 和 Production 环境变量。
4. 部署前完成 Supabase migrations 和 embedding。
5. 部署后访问 `/api/health`，再运行 staging/live smoke tests。
6. 生成二维码并准备本地录屏备份。

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
- `DASHSCOPE_API_KEY`
- `AMAP_WEB_SERVICE_KEY`
- `DEMO_ADMIN_TOKEN`

泄漏后立即撤销/轮换，不只从 Git 删除历史文件。
