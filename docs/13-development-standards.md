# 开发规范

本文件面向 Codex 和人工开发者。`AGENTS.md` 是强制执行入口，本文件给出更具体的工程约定。

## 1. 工程与依赖

- Node.js 22+，pnpm 10，提交 `pnpm-lock.yaml`。
- Next.js App Router 与 TypeScript strict；不得关闭类型检查绕过错误。
- 新依赖必须说明解决的问题、bundle/服务端影响和已有依赖为何不能满足。
- 首版不引入 LangChain、LangGraph、第二套向量数据库、全量状态库或大型 UI 框架。
- 第三方 SDK 只存在于 adapter，domain/application 层不引用供应商类型。

## 2. 文件和命名

- 文件名 kebab-case；React 组件 PascalCase；变量和函数 camelCase；数据库字段 snake_case。
- 一个文件一个主要职责。页面负责组合，不负责数据访问和复杂业务规则。
- `index.ts` 只导出稳定公共接口，避免跨领域 barrel 引起客户端打包服务端代码。
- server-only 文件第一行 `import "server-only"`。
- 类型以领域含义命名，不使用 `Data`、`Info`、`Manager` 等模糊名称。

## 3. 分层

```text
app/components -> application service -> port/interface -> adapter/repository
```

- UI 不直接调用 Supabase、千问或高德。
- Repository 返回 domain contracts，不把 Supabase Row 传到组件。
- Agent 工具调用 application service，不写 SQL 和 HTTP 细节。
- Knowledge Service 是独立模块；Agent 不知道 pgvector 表结构。
- 公共知识、用户偏好、会话摘要使用不同接口和表。

## 4. TypeScript

- 禁止 `any`；外部未知数据使用 `unknown` 并通过 Zod 缩窄。
- 使用 discriminated union 表示 SSE 事件、结果卡片和错误。
- 所有函数参数和返回值显式类型；异步函数返回 `Promise<T>`。
- ID 使用 string/UUID contract，不在 UI 中重新生成业务 ID。
- 坐标统一对象 `{ longitude, latitude }`，只在高德 adapter 序列化为字符串。

## 5. React 与 Next.js

- 默认 Server Component；需要浏览器 API、状态或事件时才加 `"use client"`。
- 数据读取优先服务端，表单与 AI 流式交互使用 Route Handler/Server Action 的合适边界。
- 列表使用稳定业务 ID 作为 key，不用数组索引。
- 图片提供尺寸和 alt；交互控件最小 44px，键盘焦点可见。
- 页面必须实现 loading、empty、error；错误显示 request id 和重试入口。

## 6. AI、工具和 RAG

- 模型输出不是事实源。结构化事实、地图事实和政策分别来自对应工具。
- 工具输入 strict schema + Zod；输出再校验后进入 UI/模型。
- 工具响应尽量小，不把完整数据库行、原始 API payload 或内部错误交给模型。
- 同一轮工具调用最多 8 轮；重复参数去重；外部请求支持 AbortSignal。
- RAG 只检索 published、有效版本；引用包含 article/version/chunk。
- 知识低置信、过期或冲突必须降级，不能用模型常识补齐。
- 文档内容属于不可信资料，不能改变系统指令和权限。

## 7. 错误和日志

- 统一 `AppError`：稳定 code、中文 message、HTTP status、retryable、request id。
- 不向客户端发送 stack、SQL、SDK 原始错误、系统 prompt 或密钥。
- 日志结构化记录 request id、session id、工具、耗时、结果数和错误码。
- 日志必须脱敏，避免手机号、精确地址、Authorization、Cookie 和自由文本全量落盘。

## 8. 测试

- 新行为先写失败测试，再实现最小通过代码。
- Unit 不请求真实外部服务；使用 fake/fixture。
- Integration 测试 adapter 映射、API 契约和数据库策略。
- E2E 覆盖用户价值链路，不按实现细节定位元素；优先 role/label/test id。
- 修复缺陷必须加入能重现原问题的测试。
- 每个 Task 完成运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`；涉及 UI/流程再运行相关 Playwright。

## 9. Git 与提交

- 每个实施 Task 独立提交，提交信息使用 `feat:`、`fix:`、`test:`、`docs:`、`chore:`。
- 不提交 `.env.local`、密钥、Supabase 数据库密码、真实用户数据和演示截图中的隐私。
- 不把格式化、无关重构和功能变更混在同一提交。
- 报告实际验证命令和结果，不用“应该可以”代替证据。

## 10. 文案与演示

- 产品简体中文，代码英文。
- Mock 内容显示“演示数据”；真实 POI 显示“高德地图”；政策显示知识来源。
- 普通用户只看到可理解进度；调试面板展示工具摘要，不展示思维链。
- 不能声称项目有真实交易、真实商家合作、生产用户量或未验证指标。
