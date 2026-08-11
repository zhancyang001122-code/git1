# Vercel Production Live 部署报告

## 部署

- Vercel project：`xiaozhi-local-life`
- Production URL：`https://xiaozhi-local-life.vercel.app`
- Deployment ID：`dpl_Gc7Gt7iU3L2JSFXK9vHUB2brUryu`
- 状态：`READY`
- 部署模式：Live

Vercel 远端使用 `pnpm@10.14.0` 安装锁定依赖，并完成 Next.js 16.3.0 production build、TypeScript 检查和 42 个页面生成。

2026-08-12 05:27（Asia/Shanghai）重新部署的代码内容与提交 `ab5f587` 一致，包含远端房源 Adapter、Live 反馈持久化、知识运营 Supabase Runtime、首页搜索参数修复、外部 API 验证脚本，以及百炼流式工具分片的兼容修复。

## 已配置环境变量

生产环境已配置：

- 产品名称、说明和默认城市/位置
- `NEXT_PUBLIC_DEMO_MODE=false`
- `NEXT_PUBLIC_ENABLE_AI_DEBUG=false`
- Supabase URL、publishable key 和 server-only secret
- 匿名会话签名 secret
- 百炼 `DASHSCOPE_API_KEY`
- 高德 `AMAP_WEB_SERVICE_KEY`
- 显式关闭本机 HTTP 房源回退

所有 Vercel 环境变量均显示为隐藏值；server-only secret 未写入 Git。

## 公网验收

- 首页 HTTP 200，HTML title 为“小智本地生活 AI 服务助手”。
- `/api/health` HTTP 200，返回 Live 模式；Supabase、Qwen、AMap 和 housing 均为 `configured`。
- 1440px 桌面视口下，产品主画布和 `main` 均为 430px，无水平溢出。
- 430px 视口下发送“请帮我查杭州武林广场附近、3500元以下的一居室，并同时用高德查附近超市。房源和周边都要分别查询。”：
  - 搜索跳转完整保留原始中文查询参数；
  - 千问完成多轮 Function Calling；
  - 房源和周边工具进度均可见；
  - Supabase 返回 5 条符合条件的 2024 历史房源，并显示“2024 历史房源数据”；
  - 高德返回真实周边 POI，并显示“高德地图”，不存在“接口演示数据”标记；
  - 点赞反馈写入 Supabase，页面显示“感谢反馈，已记录。”；
  - 页面 JavaScript 错误为 0。

公网检查已固化为 `$env:EXPECTED_PRODUCTION_MODE='live'; pnpm deploy:verify-production`。它校验健康状态、430px 横向溢出、首页搜索、千问编排、历史房源、高德来源、反馈持久化和浏览器错误。
兼容修复部署后，同一 Live 公网流程连续执行两次均通过。

## 集成故障与修复证据

首次 Live 多工具调用暴露出百炼 OpenAI-compatible 流式工具分片会用 `id: null` 和 `function.name: null` 表示沿用前一分片。原 Schema 把合法空占位映射为 `QWEN_RESPONSE_INVALID`。提交 `ab5f587` 仅允许这些供应商兼容空值，仍拒绝缺少对象结构的畸形分片；对应测试先失败后通过。

质量门禁：

- Vitest：108 个测试文件、398 个测试通过。
- Playwright：47 个通过；真实本机 OTP 和本机 HTTP 房源两个条件测试按配置跳过。
- ESLint、TypeScript strict 和 Next.js production build 通过。

## 仍未覆盖的能力

- `AUTH_ALLOWED_EMAIL` 尚未配置，因此邮箱 OTP 登录继续安全停用；游客 Live 对话不受影响。
- `DEMO_ADMIN_TOKEN` 尚未配置，因此公网知识运营管理入口不能作为已验收能力演示。
- 本报告证明千问、Supabase 房源、高德和反馈链路，不等于正式 RAG 语料、索引与固定评测集已经完成验收。
