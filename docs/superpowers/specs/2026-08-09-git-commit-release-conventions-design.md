# Git 提交与发布规范设计

## 目标

为仓库建立轻量、可执行的提交信息规范，并将 Git tag 限定为发布版本标记。规范应无需安装 Node.js 或额外包管理器即可工作。

## 提交信息规范

仓库采用 Conventional Commits 风格。提交主题必须使用以下格式之一：

```text
type: description
type(scope): description
```

允许的 `type`：

- `feat`：新增功能
- `fix`：修复缺陷
- `docs`：仅文档变更
- `style`：不影响逻辑的格式变更
- `refactor`：既非新增功能也非修复的代码调整
- `perf`：性能改进
- `test`：测试新增或调整
- `build`：构建系统或依赖变更
- `ci`：持续集成配置变更
- `chore`：其他维护工作
- `revert`：撤销已有提交

`scope` 可省略；`description` 必须非空。合并提交与 Git 自动生成的回滚提交允许通过，以免妨碍正常的 Git 工作流。

## 自动校验

仓库提交 `.githooks/commit-msg`，通过 POSIX shell 脚本校验提交主题。仓库本地配置 `core.hooksPath=.githooks`，使 Git 使用版本化 hook。

hook 在提交信息不符合规范时返回非零状态，并输出允许的格式和示例。该配置属于本地 Git 配置；其他开发者克隆仓库后需要执行一次：

```sh
git config core.hooksPath .githooks
```

## 发布标签

Git tag 仅用于发布，采用语义化版本格式 `vMAJOR.MINOR.PATCH`，例如 `v0.1.0`。普通提交不创建 tag。

- `MAJOR`：不兼容变更
- `MINOR`：向后兼容的新功能
- `PATCH`：向后兼容的缺陷修复

首个版本使用带说明的 annotated tag `v0.1.0`。

## 仓库历史与远程

现有根提交改写为 `chore: initialize repository`。规范设计文档作为后续 `docs:` 提交保留。远程 `origin` 设置为 `https://github.com/zhancyang001122-code/git1.git`，随后推送 `main` 分支及 `v0.1.0` 标签。

由于改写发生在首次推送之前，不需要强制推送，也不会覆盖远程历史。若远程已存在不相关历史，停止推送并先报告冲突。

## 仓库文档

新增 `CONTRIBUTING.md`，包含提交格式、允许类型、常用示例、启用 hook 的命令以及发布标签规则。

## 验证标准

- 合规提交信息可通过 hook。
- 不合规提交信息会被 hook 拒绝。
- `git config --get core.hooksPath` 返回 `.githooks`。
- `git log` 中的提交主题符合规范。
- `v0.1.0` 指向计划发布的提交。
- `main` 与 `v0.1.0` 成功推送到 `origin`。
