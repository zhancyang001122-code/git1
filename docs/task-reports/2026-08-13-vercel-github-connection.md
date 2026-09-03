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
- Production Branch：当前为 `main`；首次 canary 验收时为 `codex/housing-http-adapter`
- Root Directory：`web`
- Node.js：`24.x`
- Git deployments：`enabled`

GitHub App 需要对获授权仓库拥有构建、部署状态、Checks、Webhook 和工作流等权限。这里使用单仓库授权，不授予当前或未来的其他仓库。

## Canary 验收

首次 Git-triggered canary 已完成：

- Git commit：`ea820c28462f89ca184e40bdc17bb1ae05041d9d`
- Conventional Commit：`docs(deploy): add GitHub auto-deploy canary`
- Vercel deployment：`dpl_DP1fXV5mwWfN5PLgXq3mprxSTMzc`
- Source：`git` / `github`
- Vercel `gitSource.sha` 与本次 Git commit 精确相同
- Target：`production`
- 状态：`READY` / `PROMOTED`
- 正式别名：`https://xiaozhi-local-life.vercel.app`

部署后运行 `pnpm deploy:verify-production`，通过 Live 健康检查、430px 移动布局、历史房源、真实高德地图、演示商业数据、偏好提案确认边界和反馈持久化。

结论：GitHub 单仓库授权、Git 连接、Production 分支映射、`web` Root Directory、Git push 自动构建、Production 提升和部署后回归均已有在线证据。默认分支已于 2026-09-03 整理为 `main`，迁移与再次部署证据见 `docs/task-reports/2026-09-03-main-default-branch.md`；后续 `main` push 不再依赖本机手工 Vercel 部署。
