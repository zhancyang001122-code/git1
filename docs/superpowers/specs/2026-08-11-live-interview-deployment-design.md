# 小智 Live 面试版发布设计

**状态：** 已确认，待书面评审

**日期：** 2026-08-11

**目标形态：** Vercel Production 默认使用真实 Live 链路，Vercel Preview 保留明确标注的 Demo 备用链路

## 1. 背景与决策

小智最终用于作品集和面试展示。面试官访问 Production URL 时，应看到已经接入远程 Supabase、高德 Web Service、阿里云百炼千问和正式知识检索的在线版本，而不是默认进入纯模拟环境。

同时保留 Demo 能力，但它只能作为单独、明确标注的 Preview 环境。Live 服务异常时，Production 必须展示真实错误和恢复建议，不得静默切换成模拟数据并继续声称查询成功。

本设计采用以下发布策略：

- **Production：** `NEXT_PUBLIC_DEMO_MODE=false`，`SUPABASE_FALLBACK_TO_DEMO=false`。
- **Preview Demo：** `NEXT_PUBLIC_DEMO_MODE=true`，页面持续展示演示模式和模拟来源标签。
- **代码共用：** 两个环境复用相同的 UI、领域接口、Adapter 和测试，不复制两套应用。
- **环境隔离：** Production 与 Preview 使用独立环境变量；服务端密钥不进入浏览器、Git 或日志。

## 2. 关键边界

### 2.1 Live 不等于所有业务记录都是真实商业数据

Live 描述的是系统确实调用了在线服务并完成了真实持久化，不代表每个业务领域都有真实交易合作方。

| 领域                         | Production 数据性质                      | 强制展示标签                           |
| ---------------------------- | ---------------------------------------- | -------------------------------------- |
| 房源                         | 导入 Supabase 的 2024 年历史房源         | `2024 历史房源`，不承诺当前可租        |
| 周边 POI、地理编码、步行路线 | 高德 Web Service 实时结果                | `高德地图`                             |
| 团购、商家、商品、库存、订单 | Supabase 中的作品集模拟业务记录          | `演示数据` / `演示订单`                |
| 社区帖子                     | Supabase 中的模拟内容                    | `演示内容`                             |
| 用户偏好、反馈、对话         | 用户在本产品中的真实交互记录             | 保存位置、授权和隐私说明               |
| 客服知识                     | 用户提供、经过版本治理并已发布的正式资料 | 标题、版本、生效日期、引用片段         |
| AI 文本                      | 千问在线生成                             | 实际工具与资料来源，不把模型当事实来源 |

不能因为页面部署在 Production，就把团购、超市、订单或社区模拟记录描述为真实商业服务。

### 2.2 房源数据公开边界

用户愿意公开数据不等于拥有原始数据的再发布许可。Production 导入前必须完成来源、许可和隐私核验：

1. 删除姓名、完整电话、精确门牌、个人账号和其他可识别个人的信息。
2. 记录数据来源、抓取或获得时间、可公开使用的依据。
3. 如果公开许可无法确认，只发布脱敏样本或统计结果，不公开完整原始数据集。
4. 所有结果保留 `2024 历史房源` 标签，并说明不代表当前库存或状态。

### 2.3 用户偏好

- Preview Demo 将偏好保存在当前浏览器，刷新后保留，并标注“仅此设备，不是云端长期记忆”。
- Production Live 要求用户登录并明确授权，通过 `/api/preferences` 写入 Supabase。
- 服务端使用 `auth.getUser()` 确定用户身份，忽略客户端提供的任何 `userId`。
- 授权时间由服务端生成；停止长期记忆会清空已保存偏好、关闭授权并移除授权时间。
- Live 写入失败时不得回退到浏览器存储并声称云端保存成功。

此规则替代旧 API 契约中“匿名演示用户使用固定 demo profile”的描述。

## 3. 运行架构

```text
Browser
  -> Vercel Next.js Production
      -> application services
          -> Business Port  -> Supabase PostgreSQL
          -> Maps Port      -> AMap Web Service
          -> Knowledge Port -> Supabase pgvector + DashScope Embedding
          -> User Port      -> Supabase Auth + RLS
          -> AI Provider    -> DashScope Qwen OpenAI-compatible API
```

浏览器只允许获得 Supabase Project URL 和 publishable key。以下值必须仅存在于 Vercel Server 环境：

- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHSCOPE_API_KEY`
- `AMAP_WEB_SERVICE_KEY`
- `ANONYMOUS_COOKIE_SECRET`
- `DEMO_ADMIN_TOKEN`

页面不得直接写 SQL、调用 service role 客户端或持有高德和千问密钥。所有外部返回在 Adapter 边界经过 Zod 校验、超时控制和错误归一化。

## 4. 子项目拆分与实施顺序

Live 接入包含多个独立外部系统，不能作为一次大改动实施。每个子项目单独完成设计、计划、测试、在线验证和 Conventional Commit。

### 4.1 远程 Supabase

1. 创建远程项目并通过 Supabase CLI 登录和关联。
2. 应用全部迁移，验证扩展、表、索引、触发器和 RLS。
3. 验证匿名公共读取、登录用户自有数据读写和跨用户拒绝。
4. 导入许可核验后的历史房源与明确标注的模拟业务数据。
5. 接通 Auth、用户偏好、对话、反馈和工具审计。
6. 用 HTTP/PostgREST 和应用 API 形成远程验证证据。

### 4.2 高德 Web Service

1. 用户创建高德 Web 服务应用并把 Key 写入本地和 Vercel Server 环境。
2. 在线验证 POI、地理编码和步行路线。
3. 验证无结果、参数错误、额度限制、超时和供应商异常。
4. UI 展示真实来源，不把浏览器定位等同于高德查询成功。

### 4.3 千问与工具编排

1. 用户开通百炼并把 `DASHSCOPE_API_KEY` 写入本地和 Vercel Server 环境。
2. 在线验证流式回答、取消、超时、限流和稳定错误结构。
3. 验证模型只能调用白名单工具，工具参数经过 Zod 校验。
4. 验证房源价格、库存、距离和政策结论只来自实际工具结果。

### 4.4 正式知识材料与 RAG

1. 用户提供 6–10 份有权使用的客服规则资料，包含来源、负责人、生效日期和版本信息。
2. 完成清洗、版本化、切片、Embedding、混合召回和可选 Rerank。
3. 建立包含正确答案、无答案、冲突、过期版本和提示注入的评测集。
4. 验证引用字段、低置信拒答、知识候选审核、发布、索引和回滚闭环。

### 4.5 Vercel Production

1. 将经过评审的集成分支通过 PR 合并到 `main`，把 `main` 设为生产分支。
2. Vercel Root Directory 固定为 `web`，Node 与 pnpm 版本遵循仓库配置。
3. Production 配置完整 Live 变量；Preview Demo 只配置明确需要的演示变量。
4. 部署前完成数据库迁移和知识索引，部署后运行线上 smoke 和 Playwright。
5. 使用手机和桌面验证 430px 画布、登录、真实查询、错误态、刷新和隐私提示。

## 5. 错误和降级策略

- Supabase、高德、千问和 Knowledge Service 分别设置明确超时。
- 外部错误统一为稳定的 `code`、`message`、`retryable` 和 `requestId`。
- Production 禁止静默 Demo fallback；真实失败必须保留真实来源和错误状态。
- 高德失败不能伪造距离或路线；千问失败不能用固定文本冒充模型回答。
- RAG 无结果、低置信或版本冲突时拒绝确定性政策结论。
- 写操作不得因重试产生重复偏好、反馈、知识版本或订单。
- Preview Demo 必须在页面级和结果卡级显示模拟标识。

## 6. 安全与运维

- `.env.local`、数据库密码和 API Key 不提交 Git，也不粘贴到项目文档或聊天正文。
- 日志不记录完整 Prompt、完整隐私字段、访问令牌或原始供应商响应。
- 所有用户表启用 RLS；service role 仅用于必要的服务端管理动作。
- Production 的固定窗口内存限流在上线前升级为共享限流存储，避免 Vercel 多实例绕过限制。
- 健康检查只报告 `configured`、`available`、`unavailable` 或 `not_checked`，不返回密钥值。
- 生产错误通过请求 ID 关联日志，面试展示只暴露工具名、参数摘要、耗时、来源、结果数和错误码。

## 7. 验收证据

只有以下证据全部存在时，才能称为“Live 面试版已完成”：

1. 远程 Supabase 迁移和 RLS HTTP 验证通过。
2. 2024 历史房源已经脱敏导入，并能通过 Production API 查询。
3. 高德三个在线能力各有成功、无结果和异常 smoke 证据。
4. 千问完成一次真实流式工具调用，并验证取消、超时或限流行为。
5. 正式知识资料完成发布、Embedding、检索、引用和评测。
6. 用户登录、偏好授权、撤销、对话和反馈真实持久化。
7. Vercel Production URL 可访问，手机和桌面关键流程通过。
8. 浏览器产物扫描没有服务端密钥，跨用户 RLS 请求被拒绝。
9. Production Live 失败时没有静默切到 Demo。
10. 完整质量门通过：

```bash
cd web
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

每个在线验证记录实际日期、环境、请求类型、结果和脱敏证据；不能只用 Mock 单测证明在线服务已经接通。

## 8. 用户与 Codex 的协作边界

用户负责：

- 完成 Supabase、高德、百炼和 Vercel 的账号登录、实名认证、条款接受和可能产生费用的操作。
- 在本机或平台环境变量页面填写密钥，不在聊天或 Git 中发送密钥。
- 提供房源数据来源与使用许可说明。
- 提供有权使用的正式知识资料并确认内容有效性。

Codex 负责：

- 指导用户逐步完成平台操作，并在需要用户操作时一次只给出当前步骤。
- 完成代码、迁移、Adapter、测试、部署配置和脱敏验证。
- 对每条 Live 链路执行真实在线 smoke，记录成功和未完成项。
- 使用 Conventional Commits；只有真实发布完成后才创建 release tag。

## 9. 面试表述

完成后可以诚实表述为：

> Production 默认运行 Live 链路：结构化业务和用户数据进入启用 RLS 的 Supabase，高德提供实时位置能力，千问负责受限工具编排和表达，Knowledge Service 使用版本化资料完成检索与引用。团购、超市和订单仍是明确标注的模拟业务数据；2024 房源是历史快照，不代表当前可租。系统保留独立 Demo 预览用于故障演示，但 Production 不会在外部服务失败时静默伪造成功结果。
