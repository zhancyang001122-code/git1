# Vercel 受保护 Preview 部署报告

## 结论

- Vercel project：`xiaozhi-local-life`
- 最终 Preview Deployment ID：`dpl_6S7MDVCMMS6SijLAm69bn5ykyZYQ`
- Preview URL：`https://xiaozhi-local-life-g9gi19vtz-zhancyang001122-7132s-projects.vercel.app`
- 部署状态：`READY`
- 运行模式：明确的 Demo
- 访问边界：Vercel Authentication 保护，不作为公开面试链接

Preview 没有复制 Production 的 Supabase、千问或高德密钥。当前目标是证明无外部配置时仍能构建、运行和降级，而不是把同一生产数据库包装成 staging。需要 Live staging 时，应先创建独立 Supabase 项目和独立环境变量。

## 冒烟证据

通过可选 `x-vercel-protection-bypass` 请求头运行通用部署验证器：

```powershell
$env:DEPLOYMENT_URL='https://xiaozhi-local-life-g9gi19vtz-zhancyang001122-7132s-projects.vercel.app'
$env:EXPECTED_DEPLOYMENT_MODE='demo'
$env:VERCEL_AUTOMATION_BYPASS_SECRET='<未写入仓库的 Vercel secret>'
pnpm deploy:verify
```

最终结果：

```text
PASS deployment demo health, mobile layout, housing, maps, commerce, preference proposal and feedback flow.
```

验证覆盖：

- `/api/health` 返回 `mode: demo`，Supabase、Qwen、AMap 和 housing 均为 `disabled`。
- 430px 首屏无水平溢出。
- 首页搜索参数可进入小智对话。
- 确定性 Demo 房源卡可见，并显示本地演示状态。
- 页面 JavaScript 和业务错误提示为 0。

## 真实暴露的两层缺陷

第一次部署 `dpl_9rCycsiYFjfreXYwT4PVUnkh7SvR` 在预渲染 `/me/preferences` 时失败。该页面无条件创建 Supabase 客户端，因此无配置 Demo 无法完成构建。修复后，Demo 访问偏好页会在创建客户端前安全跳转登录；Live 仍通过真实会话检查。

第二次部署 `dpl_3pnCqy2uk3SC5Y6aPPaZQousMV1s` 已构建为 `READY`，但 `/api/health` 返回 500。Vercel 日志证明全局 Proxy 仍对每个 Demo 请求无条件刷新 Supabase 会话。修复后，Demo Proxy 直接透传，Live Proxy 继续调用 `auth.getUser()` 刷新会话。

两处修复都先增加失败测试，再实现最小分支；最终 Preview 同时通过 Vercel 构建和受保护浏览器冒烟。

修复随提交 `0542b94` 推送；同一提交随后手动部署到 Production，并通过完整 Live 回归，证明 Demo 分支修复没有破坏 Live 会话刷新。

完整本地质量门同时通过：

- Prettier format check、ESLint、TypeScript strict 和 Next.js production build 通过。
- Vitest：109 个测试文件、405 个测试通过。
- Playwright：47 个默认 E2E 通过；真实本机 OTP 与本机 HTTP 房源两个专项用例按配置跳过。

## 部署保护与密钥事件

Preview 保持 Vercel Authentication，不为方便测试而公开。验证脚本支持从进程环境读取自动化 bypass，并只通过请求头发送。

排查 CLI 自动化访问时，一枚 bypass 曾因 Vercel API 把 secret 作为对象字段名而出现在本地命令输出中；随后一次空 PATCH 又生成了第二枚。处理方式是立即把两枚都视为泄露：撤销临时 secret，并重新生成系统 secret。最终只保留一枚未输出的替代 secret；任何值都未写入 Git、文档或环境文件。

这次事件的工程结论是：脱敏检查不能只检查 JSON value，也必须考虑敏感信息可能出现在 key 中；自动化脚本不应打印原始项目保护配置。

## 仍需账号操作

Vercel 项目尚未建立 GitHub Login Connection。CLI 尝试连接 `zhancyang001122-code/git1` 时被 Vercel 以 400 拒绝，因此 Git push 目前不会自动部署。完成该 OAuth 前继续使用可审计的 `vercel deploy --prod`；连接时应只授权所需仓库，不在无人确认时扩大到所有仓库。
