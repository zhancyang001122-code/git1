# Vercel 生产基线部署报告

## 部署

- Vercel project：`xiaozhi-local-life`
- Production URL：`https://xiaozhi-local-life.vercel.app`
- Deployment ID：`dpl_EE94r2dzYNHVEoz2RegFyrEgErEx`
- 状态：`READY`
- 部署模式：明确标注的 Demo 基线

Vercel 远端使用 `pnpm@10.14.0` 安装锁定依赖，并完成 Next.js 16.3.0 production build、TypeScript 检查和 42 个页面生成。

2026-08-12 04:20（Asia/Shanghai）重新部署已验证提交 `bbd8cb4`，包含远端房源 Adapter、Live 反馈持久化、知识运营 Supabase Runtime、首页搜索参数修复和外部 API 验证脚本。生产环境仍保持明确 Demo，未因代码具备 Live 能力而提前打开缺少外部 Key 的功能。

## 已配置环境变量

生产环境已配置：

- 产品名称、说明和默认城市/位置
- `NEXT_PUBLIC_DEMO_MODE=true`
- `NEXT_PUBLIC_ENABLE_AI_DEBUG=false`
- Supabase URL、publishable key 和 server-only secret
- 匿名会话签名 secret
- 显式关闭本机 HTTP 房源回退

所有 Vercel 环境变量均显示为隐藏值；server-only secret 未写入 Git。

## 公网验收

- 首页 HTTP 200，HTML title 为“小智本地生活 AI 服务助手”。
- `/api/health` HTTP 200，并诚实返回 Demo 模式及外部服务 disabled。
- 1440px 桌面视口下，产品主画布和 `main` 均为 430px，无水平溢出。
- 430px 视口下发送“找武林广场附近 3500 元以内的一居室”：
  - 搜索跳转完整保留原始中文查询参数；
  - 房源工具进度可见；
  - 4 张房源卡可见；
  - Demo 披露可见；
  - 页面 JavaScript 错误为 0。

以上公网检查已固化为 `pnpm deploy:verify-production`，包含健康状态、Demo 披露、430px 横向溢出、首页搜索、房源工具结果与浏览器错误检查。

## 尚未满足 Live 验收的配置

当前本机没有以下值，因此不能诚实切换到 Live：

- `DASHSCOPE_API_KEY`
- `AMAP_WEB_SERVICE_KEY`
- `AUTH_ALLOWED_EMAIL`

在这三项补齐、写入 Vercel 并重新部署前，生产站保持 Demo 模式。Supabase 历史房源已经完成远端导入与激活，但 Demo 模式不会冒充已通过千问编排的完整 Live 对话。
