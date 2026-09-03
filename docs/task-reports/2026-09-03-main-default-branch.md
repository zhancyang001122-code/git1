# GitHub 默认分支迁移与 Vercel 回归报告

日期：2026-09-03

## 目标

把作品集仓库的 GitHub 默认分支从阶段性开发名称 `codex/housing-http-adapter` 整理为行业常用的 `main`，同时确保本机跟踪关系、面试预检和 Vercel Production 自动部署不会因改名失效。

## 迁移前事实

- GitHub 仓库：`zhancyang001122-code/git1`
- GitHub 默认分支：`codex/housing-http-adapter`
- Vercel 项目：`xiaozhi-local-life`
- 本机正式工作树当时位于 `codex/social-housing-leads`
- 面试预检脚本硬编码要求旧分支名，直接改名会导致预检误报失败

## 实施内容

1. 为面试预检增加独立的 `PRODUCTION_INTERVIEW_BRANCH = "main"` 约束与单元测试。
2. 在旧默认分支仍存在时先推送兼容提交 `63613d96d5808ff2da3f52e5b35df5aa3f783ce5`，避免改名后预检脚本仍要求旧名称。
3. 通过 GitHub Branch Rename API 把远端 `codex/housing-http-adapter` 原位重命名为 `main`；不是另外创建一条内容可能漂移的新分支。
4. 将本机 `main` 快进到同一提交并设置为跟踪 `origin/main`，刷新 `origin/HEAD`，删除已合并的本机旧分支引用。
5. 保留 `codex/social-housing-leads` 作为开发历史分支，但它不再是默认分支或 Production 来源。

## 在线证据

- GitHub `defaultBranchRef.name` 返回 `main`。
- 远端分支列表包含 `main`，不再包含 `codex/housing-http-adapter`。
- GitHub 为提交 `63613d96d5808ff2da3f52e5b35df5aa3f783ce5` 记录了成功的 Vercel `Production` deployment（GitHub deployment id `6245049446`）。
- `https://xiaozhi.zaneyang.xyz/api/health` 与 `https://xiaozhi-local-life.vercel.app/api/health` 均返回同一完整提交号 `63613d96d5808ff2da3f52e5b35df5aa3f783ce5`。
- 正式健康接口同时返回 `mode=live`，Supabase、Qwen、Rerank、AMap 和 Housing 均为 `configured`。

以上提交号精确匹配证明：Vercel 不只是构建了一个孤立 Preview，而是已经把 `main` 的提交提升到正式别名。

## 本地质量门禁

- 面试预检分支测试先因缺少 `assertProductionBranch` 失败，随后实现并通过。
- `pnpm format:check`：通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：145 个测试文件、614 个测试全部通过。
- `pnpm build`：通过。

## 结论

GitHub 默认分支、本机正式分支、`origin/HEAD`、面试预检约束和 Vercel Production 部署来源现在统一为 `main`。以后在 `main` 上完成并推送正式提交，即可触发 Production 自动部署；功能分支仍应采用 `codex/` 前缀开发，并在验证后合入 `main`。
