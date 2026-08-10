# Vercel 部署手册

## 1. 部署前门禁

在仓库 `web/` 目录执行并保存结果：

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
$env:PLAYWRIGHT_PORT='3310'; pnpm test:e2e
```

任何失败都不得继续标记发布版本。

## 2. Vercel 项目设置

- Framework Preset：Next.js
- Root Directory：`web`
- Node.js：22
- Install Command：`pnpm install --frozen-lockfile`
- Build Command：`pnpm build`
- Output Directory：保持 Next.js 默认

Preview 与 Production 环境变量分开配置。不要把真实密钥写入 Git、构建日志或 `NEXT_PUBLIC_*`。

## 3. Demo Preview

用于面试前的确定性预览：

```env
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ENABLE_AI_DEBUG=true
DEMO_ADMIN_TOKEN=<至少 32 位随机值>
```

Demo Preview 不需要 Supabase、高德或百炼账号。页面必须持续显示模拟来源，不能对外描述为实时服务。

## 4. Live 环境准备

1. 创建 Supabase 项目并配置 URL、publishable key、service role key。
2. 使用 Supabase CLI link 项目，在根目录按顺序应用 `supabase/migrations/`。
3. 执行 `pnpm db:verify-http`，验证 anon、authenticated 和 service role 边界。
4. 配置百炼文本模型、`text-embedding-v4`，按需配置 `qwen3-rerank`。
5. 配置高德 Web 服务 Key，不使用浏览器 JS Key。
6. 房源方案二选一：将清洗后的历史数据导入 Supabase，或把 `services/housing-api` 独立部署到可由 Vercel 服务端访问的 HTTPS 环境。`127.0.0.1` 只适用于本机，Vercel 无法访问用户电脑。
7. 导入已脱敏并带版本、生效日期、负责人和来源的正式知识材料。
8. 为已发布知识版本生成 1024 维 Embedding，运行 RAG 评测。
9. 只有上述步骤全部通过后，才将 `NEXT_PUBLIC_DEMO_MODE=false`。

完整变量以 `.env.example` 为准。

## 5. 部署后冒烟

依次验证：

1. `/api/health` 不包含密钥，模式与服务配置一致。
2. 首页、五个主页面和关键详情页可访问，360/390/430px 无横向溢出。
3. 房源结果显示正确年份和数据来源，不描述为当前可租。
4. RAG 回答展示来源、版本、生效日期和引用。
5. 高德 POI/路线来自 Live Adapter；故障时不估算距离。
6. 点踩生成候选但不会直接发布。
7. 浏览器源码和 Network 响应中不存在服务端密钥。

未配置真实外部服务时，只能完成 Demo Preview 冒烟，不能记录为 Production Live 通过。

## 6. 二维码与备份视频

获得正式 HTTPS URL 后生成二维码：

```powershell
npx qrcode-terminal "https://your-production-domain.example"
```

二维码必须在手机网络下实测。另录制一段三分钟主演示视频，文件保存在仓库外或发布附件中，避免大型二进制进入 Git。
