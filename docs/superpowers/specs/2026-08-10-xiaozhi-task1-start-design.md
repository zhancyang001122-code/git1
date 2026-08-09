# 小智 Task 1 启动设计

## 1. 目标

将 `xiaozhi-local-life-codex-kit` 完整、安全地导入正式 Git 仓库 `C:\Users\Administrator\Desktop\git1`，随后只执行现有实施计划的 Task 1：建立可运行、可测试、可构建的 Next.js 工程地基。

本阶段不开发页面业务、Supabase、千问、高德、RAG 或房源接入。结束时必须停下验收和复盘，不自动进入 Task 2。

## 2. 为什么先导入规格包

当前正式仓库只有基础 README、Git 规范设计和房源 API 设计；完整 PRD、架构、契约、原型、数据库迁移和验收标准仍在 Downloads 目录。

规格包是项目的单一事实来源。将它纳入正式仓库，可以让需求、实现、测试和提交历史一起接受审查，也能让其他人在没有原电脑下载目录的情况下理解和复现项目。

## 3. 规格包导入策略

### 3.1 来源与目标

- 只读来源：`C:\Users\Administrator\Downloads\xiaozhi-local-life-codex-kit\xiaozhi-local-life-codex-kit`
- 正式目标：`C:\Users\Administrator\Desktop\git1`

来源目录保持不变，不在 Downloads 中直接开发。

### 3.2 导入内容

导入以下规格资产：

- `AGENTS.md`
- `MANIFEST.md`
- `codex/`
- `config/`
- `contracts/`
- `design/`
- `docs/`
- `qa/`
- `scripts/`
- `supabase/`

根 `README.md` 不直接覆盖；将规格包的重要说明合并进正式仓库 README，同时保留现有仓库说明。

### 3.3 冲突处理

- 复制前分别列出来源和目标文件清单。
- 对同一路径文件计算 SHA-256 或比较内容。
- 内容相同的文件不重复处理。
- 内容不同的文件停止该文件的覆盖，人工合并。
- 已提交的房源设计与 Git 规范设计必须保留。
- 不复制 `.git`、缓存、临时文件或真实密钥。

### 3.4 导入验收

- 来源规格包未被修改。
- 目标仓库包含规格包清单中的所有必要文件。
- 已有设计文档仍存在且内容不变。
- `git diff --check` 无格式错误。
- 导入提交只包含规格和文档资产，不包含 `web/` 代码。
- 使用提交：`chore(xiaozhi): import project specification kit`。

## 4. Task 1 工程范围

规格导入完成后，在仓库根目录创建 `web/`，不在根目录直接运行 `create-next-app .`。

Task 1 只产生以下能力：

1. Next.js App Router + TypeScript strict + Tailwind 工程。
2. pnpm 锁文件和明确的依赖清单。
3. ESLint、TypeScript、Prettier、Vitest、Testing Library、Playwright 质量入口。
4. 服务端与客户端环境变量分离校验。
5. 不访问外部网络的 `/api/health` 配置状态接口。
6. 最小单元测试和浏览器 smoke test。
7. 显式 demo 模式；缺少外部密钥时不假装服务已经接通。

Task 1 不产生：

- 完整视觉页面
- 业务数据查询
- 用户登录
- Supabase 客户端或数据库连接
- 千问对话
- 高德地图调用
- RAG
- 房源服务接入
- Vercel 正式部署

## 5. 工程边界

```text
git1/
├── AGENTS.md               # 全仓执行规则
├── docs/                   # 需求、架构、设计与验收
├── contracts/              # API、工具和领域契约
├── design/                 # 原型和设计规范
├── supabase/               # 后续数据库迁移
├── qa/                     # 评测与演示资料
└── web/                    # Task 1 创建的实际 Next.js 应用
```

Vercel 后续只把 `web/` 作为 Root Directory；规格、迁移和验收资料继续留在仓库根目录。

## 6. 环境变量与密钥边界

浏览器可读取的变量必须使用 `NEXT_PUBLIC_*`，并且只能包含可公开配置。Supabase service role、千问和高德服务端密钥绝不能进入客户端 bundle、日志、错误响应或测试快照。

`/api/health` 只返回：

- 当前应用模式；
- Supabase、Qwen、高德分别是 `configured`、`missing` 或 `disabled`；
- 不返回密钥内容；
- 不在 Task 1 调用任何外部服务。

## 7. 质量门禁

Task 1 完成前必须运行：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

每个命令的意义：

- `lint`：发现不符合代码规则和常见错误模式的问题。
- `typecheck`：证明 TypeScript 类型关系成立，不代表运行逻辑一定正确。
- `test`：证明被测试的行为符合预期，不代表未覆盖行为正确。
- `build`：证明生产构建能生成，不代表外部服务已经可用。

四个命令全部通过，才允许提交 Task 1。Playwright 配置和 smoke test在本阶段建立；浏览器安装或环境限制导致无法执行时必须报告真实状态，不能把“已配置”写成“已通过”。

## 8. 提交边界

采用两个独立提交，便于审查和回退：

1. `chore(xiaozhi): import project specification kit`
2. `chore(web): scaffold xiaozhi application`

普通提交不创建 Git tag。未配置并检查 `origin` 前不推送。

## 9. 学习与面试验收

Task 1 结束时，学生需要能用自己的话回答：

1. 为什么规格包和应用代码放在同一仓库、不同目录？
2. repository、working tree、commit 分别是什么？
3. 为什么 Next.js 同时存在浏览器代码和服务端代码？
4. 为什么服务端密钥不能使用 `NEXT_PUBLIC_*`？
5. demo、configured、unavailable 的区别是什么？
6. `lint`、`typecheck`、`test`、`build` 分别提供什么证据，又不能证明什么？
7. 为什么第一阶段只搭地基，不一次性开发全部功能？

学习采用快节奏：先看可运行结果，再解释本阶段首次出现的关键概念，最后形成 30–60 秒面试表达。不要求背诵生成代码，但要求能解释模块职责、风险边界和验收证据。

## 10. 完成定义

只有同时满足以下条件，Task 1 才完成：

- 规格包已完整导入并有独立提交。
- `web/` 能以 demo 模式运行。
- 环境变量契约和 `/api/health` 已通过测试。
- 代码不存在服务端密钥泄漏。
- `lint`、`typecheck`、`test`、`build` 全部通过。
- 工作区干净。
- Task 1 有独立 Conventional Commit。
- 已向用户解释关键概念和验证证据。
- 明确停止，不执行 Task 2。

