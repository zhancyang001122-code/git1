# Vercel GitHub 自动部署验收报告

日期：2026-08-13

## 目标

把 Vercel 项目 `xiaozhi-local-life` 与 GitHub 仓库 `zhancyang001122-code/git1` 连接，使默认生产分支的 Git push 自动触发 Production 构建，避免依赖本机手工执行 `vercel --prod`。

## 连接配置证据

- GitHub App：`Vercel`
- GitHub 授权范围：`Only select repositories`
- 已授权仓库：仅 `zhancyang001122-code/git1`（GitHub 页面显示 `Selected 1 repository`）
- Vercel Project：`prj_0j62RhcRGFD4BkgeY1mHxdxkxoiW`
- Vercel Git link：`github / zhancyang001122-code / git1`
- Production Branch：`codex/housing-http-adapter`
- Root Directory：`web`
- Node.js：`24.x`
- Git deployments：`enabled`

GitHub App 需要对获授权仓库拥有构建、部署状态、Checks、Webhook 和工作流等权限。这里使用单仓库授权，不授予当前或未来的其他仓库。

## Canary 验收

本报告所在的文档提交作为首次 Git-triggered canary。只有在 push 后观察到与该提交 SHA 对应的 Vercel Production deployment、状态为 `READY`、正式别名完成切换，并再次通过 Production Live 回归，才能把自动部署标记为完成。

当前状态：Git 连接已建立，canary 尚待 push 后验证。
