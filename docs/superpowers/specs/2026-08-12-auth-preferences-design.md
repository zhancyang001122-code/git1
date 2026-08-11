# 小智 Auth 与长期偏好设计

> **后续决策：** Auth 的 CAPTCHA 与公开注册方案已由 `2026-08-12-interview-otp-simplification-design.md` 取代。当前 Production 使用单个服务端演示邮箱白名单；本文件中的相关旧条款仅保留为设计演进记录，不再作为实现要求。

**状态：** 交互方案已确认，待书面评审

**日期：** 2026-08-12

**适用范围：** Production Live 的邮箱验证码登录、Supabase 会话、长期偏好授权与撤销；不改变公开业务页面的匿名浏览能力

## 1. 背景与决策

小智的公开房源、团购、超市、周边和知识内容允许匿名浏览，但长期偏好属于个人数据。Production Live 不能再使用固定演示用户或浏览器本地存储冒充云端记忆，必须先建立真实用户会话，再由 Supabase RLS 隔离每位用户的数据。

本阶段采用以下方案：

- 公开业务页面继续允许游客浏览。
- 需要读取或保存个人数据时，跳转到 `/login?next=<internal-path>`。
- 登录方式为邮箱加 6 位验证码，不使用密码。
- Supabase Auth 创建真实会话；Next.js `proxy.ts` 负责刷新会话 Cookie。
- API 使用 `auth.getUser()` 获得可信 `auth.uid()`，不接收客户端 `userId`。
- `/me/preferences` 只展示和编辑当前登录用户在 Supabase 中的真实偏好。
- 模型只能提出偏好更新；用户必须在界面中确认后，应用 API 才能写入数据库。
- 用户关闭长期记忆时删除 `user_preferences` 中自己的整行数据。
- Live 写入失败时保留表单和错误提示，不回退到浏览器存储并宣称保存成功。

## 2. 目标与非目标

### 2.1 目标

1. 完成可在线验证的邮箱 OTP 登录、会话刷新、登出和安全返回原页面流程。
2. 完成登录用户自己的长期偏好读取、部分更新、明确授权和彻底撤销。
3. 让 UI、API、Repository 和 RLS 形成多层权限边界。
4. 让面试演示能够说明“模型建议”和“用户授权写入”的区别。
5. 提供单元、API、RLS、组件和 E2E 证据，而不是只证明页面能点击。

### 2.2 非目标

- 本阶段不实现密码登录、手机号登录、Google/GitHub OAuth 或企业 SSO。
- 本阶段不新增不可篡改的合规审计事件表。
- 本阶段不把所有收藏、地址、订单和对话同时改造成登录态写入。
- 本阶段不解决高德、千问、RAG 正式资料和房源公开部署的剩余问题。
- 本阶段不将 Web 作品改造成可提交微信审核的原生小程序。

## 3. 已有能力与真实缺口

### 3.1 已有能力

- `public.user_preferences` 已包含偏好字段、`allow_long_term_memory`、`consented_at` 和更新时间。
- `preferences_own_all` RLS 策略限制登录用户只能操作 `user_id = auth.uid()` 的记录。
- `authenticated` 角色已获得该表的 `select`、`insert`、`update` 和 `delete` 权限。
- Auth 新用户触发器会创建 `user_profiles`。
- 仓库已有 Supabase browser/server client、偏好 Repository、读取工具和测试基础。

### 3.2 真实缺口

- 没有 `/login`、OTP API、登出 API 和会话刷新 `proxy.ts`。
- 没有 `GET/PATCH /api/preferences`。
- `/me/preferences` 当前只是本地表单，并明确没有写入 Supabase。
- 现有 `save_user_preference` 接受模型生成的 `consent_confirmed: true` 后直接写库。模型生成的布尔值不是用户授权证据，该写路径必须移除。
- 当前 Repository 允许调用方传入 `consentedAt`，无法保证授权时间来自服务端可信时钟。
- 当前 API 契约仍写有“匿名演示用户使用固定 demo profile”，与 Production Live 决策冲突，需要同步修订。

## 4. 用户旅程

### 4.1 游客浏览

游客可以访问公开业务页。点击“长期偏好”“保存为长期记忆”等个人操作时，系统把当前内部路径编码为 `next`，跳转登录页。游客状态不得显示“已保存到云端”。

### 4.2 邮箱验证码登录

1. 用户输入邮箱并请求验证码。
2. 服务端严格校验请求、限流并调用 Supabase `signInWithOtp()`。
3. 邮件模板使用 `{{ .Token }}` 发送 6 位验证码，而不是只发送 Magic Link。
4. 用户输入验证码，服务端调用 `verifyOtp({ email, token, type: "email" })`。
5. Supabase 会话写入 `@supabase/ssr` 管理的 Auth Cookie。
6. 客户端只跳转到经过校验的内部 `next`；没有合法 `next` 时进入 `/me`。

发送接口对“新邮箱”和“已存在邮箱”使用相同的成功文案，避免泄露账号是否存在。验证码错误保留邮箱和输入界面，允许用户重新输入或重新发送。

### 4.3 管理长期偏好

1. 登录用户进入 `/me/preferences`。
2. 页面通过 `GET /api/preferences` 读取自己的云端状态。
3. 页面明确说明保存内容、使用目的、保存位置和关闭后的删除行为。
4. 用户编辑预算、宠物、常用区域、饮食限制、交通方式或家庭情况。
5. 用户点击“同意并保存到云端”，确认弹窗展示将被保存的字段。
6. `PATCH /api/preferences` 以当前会话身份保存偏好；成功后展示授权时间和更新时间。
7. 用户点击“关闭长期记忆并删除偏好”并二次确认后，服务端删除该用户整行偏好。

### 4.4 对话中的偏好提案

当用户说“记住我不吃辣”时：

1. 模型只能调用只读 `get_user_preferences`，或产生 `propose_user_preference` 提案。
2. 提案经过 Zod 校验后以确认卡展示准确的字段和值。
3. 用户点击“确认保存”才调用 `PATCH /api/preferences`。
4. 用户取消、忽略或离开页面均不产生数据库写入。
5. 当前消息中的明确条件始终优先于长期偏好，但不会自动改写已保存偏好。

## 5. 组件与职责

```text
Browser UI
  -> /api/auth/*
      -> Supabase Auth client with cookie session
  -> /api/preferences
      -> requireAuthenticatedUser()
          -> Preferences application service
              -> MemoryRepository with user-session Supabase client
                  -> user_preferences + RLS

Qwen Agent
  -> get_user_preferences (read only)
  -> propose_user_preference (no database write)
      -> confirmation card
          -> user click
              -> PATCH /api/preferences
```

拟新增或调整的边界：

- `web/src/proxy.ts`：刷新 Supabase Auth 会话，不承担业务授权判断。
- `web/src/app/login/page.tsx`：邮箱和验证码两阶段界面。
- `web/src/app/api/auth/otp/send/route.ts`：发送验证码。
- `web/src/app/api/auth/otp/verify/route.ts`：校验验证码并建立会话。
- `web/src/app/api/auth/sign-out/route.ts`：注销当前会话。
- `web/src/app/api/preferences/route.ts`：读取、更新和撤销偏好。
- `web/src/features/preferences/schemas.ts`：API 输入输出 Zod 契约。
- `web/src/features/preferences/service.ts`：授权、服务端时间和删除语义。
- `web/src/features/memory/repository.ts`：只接收经过应用服务处理的可信用户 ID 和授权时间，并增加删除能力。
- `contracts/tool-contracts.json`：用无副作用的 `propose_user_preference` 替代模型可执行的 `save_user_preference`。

React 页面不直接访问数据表；Agent 不接触 service role、Cookie 或 RLS 实现。

## 6. Auth API 契约

所有响应带 `cache-control: no-store` 和 `x-request-id`。JSON 错误沿用统一结构：`code`、中文 `message`、`retryable` 和 `requestId`。

### 6.1 `POST /api/auth/otp/send`

请求：

```json
{
  "email": "user@example.com",
  "captchaToken": "optional-in-local-development"
}
```

规则：

- 请求体有大小上限，Schema 为 strict，未知字段拒绝。
- 邮箱先 trim 和规范化，再交给 Supabase Auth。
- 公开 Production 必须验证 CAPTCHA；本地开发可显式关闭。
- 按客户端和规范化邮箱摘要双维度限流，日志不记录完整邮箱。
- 成功统一返回 `200 { "ok": true }`，不暴露用户是否已存在。

### 6.2 `POST /api/auth/otp/verify`

请求：

```json
{
  "email": "user@example.com",
  "token": "123456",
  "next": "/me/preferences"
}
```

规则：

- `token` 必须是 6 位数字。
- `next` 只允许以单个 `/` 开头的站内路径；拒绝协议、`//`、反斜杠、控制字符和外部主机。
- 验证成功后返回 `200 { "ok": true, "next": "/me/preferences" }` 并写入会话 Cookie。
- 验证失败不创建本地伪会话，不返回供应商原始错误。

### 6.3 `POST /api/auth/sign-out`

- 仅注销当前浏览器会话并清除 Auth Cookie，不删除用户业务数据。
- 成功返回 `200 { "ok": true }`。
- 登录界面另行提供“删除长期偏好”的明确动作，避免把登出和删数据混为一谈。

## 7. Preferences API 契约

### 7.1 `GET /api/preferences`

未登录返回 `401 AUTH_REQUIRED`。登录且没有偏好行时返回：

```json
{
  "allowLongTermMemory": false,
  "preferences": null,
  "consentedAt": null,
  "updatedAt": null
}
```

存在已授权偏好时返回：

```json
{
  "allowLongTermMemory": true,
  "preferences": {
    "maxHousingBudget": 3500,
    "pets": ["猫"],
    "preferredAreas": ["武林广场"],
    "dietaryRestrictions": ["不吃辣"],
    "transportModes": ["地铁"],
    "familyProfile": []
  },
  "consentedAt": "2026-08-12T08:00:00.000Z",
  "updatedAt": "2026-08-12T08:00:00.000Z"
}
```

### 7.2 `PATCH /api/preferences`

启用或更新：

```json
{
  "allowLongTermMemory": true,
  "preferences": {
    "dietaryRestrictions": ["不吃辣"]
  }
}
```

关闭并删除：

```json
{
  "allowLongTermMemory": false
}
```

规则：

- 请求使用 strict discriminated union；启用时至少包含一个偏好字段，关闭时不得夹带偏好字段。
- 省略字段表示保留原值；空数组表示清空该列表；`maxHousingBudget: null` 表示清空预算。
- 数组去除首尾空白和重复项，并限制单项长度、数量与总请求体大小。
- 用户 ID 只来自 `auth.getUser()`，请求体中出现 `userId` 直接视为未知字段并拒绝。
- 首次启用或删除后重新启用时，服务端生成新的 `consented_at`。
- 已启用状态下修改字段时保留原 `consented_at`，由 `updated_at` 表示最近一次修改。
- 关闭长期记忆执行 `delete ... where user_id = auth.uid()`；成功后再次 GET 必须表现为没有偏好行。
- API 使用用户会话 Supabase client，让 RLS 成为第二道权限边界；不得使用 service role 绕过 RLS。

`consented_at` 表示当前这次长期记忆授权的开始时间，`updated_at` 表示偏好最近更新时间。V1 不把它描述为不可篡改、逐事件的合规审计链。

## 8. 授权与模型边界

现有 `save_user_preference` 必须从模型可执行工具中移除，替换为无副作用的 `propose_user_preference`：

- 输入仍限制在允许的偏好 key 和对应值类型。
- 工具只返回待确认 key、规范化 value 和公开提示，不调用 Repository。
- 前端把返回值渲染为“保存 / 取消”确认卡。
- 只有真实用户点击“保存”后才调用 Preferences API。
- 确认卡必须完整显示即将写入的值，不允许隐藏附加字段。
- `get_user_preferences` 保持只读；没有会话或没有授权时返回稳定状态，不泄露其他用户数据。

这条边界的核心不是“模型是否说用户同意”，而是写操作是否经过独立的用户界面动作和服务端会话授权。

## 9. 会话与安全

- `proxy.ts` 仅刷新会话，业务 API 仍逐次调用 `auth.getUser()`；不得只相信可被伪造或过期的客户端状态。
- 登录后的页面跳转必须使用安全 `next` 解析器，防止 open redirect。
- Auth Cookie 保持 Supabase SSR 客户端兼容，使用 `SameSite=Lax`，Production 增加 `Secure` 并强制 HTTPS。当前安装版本默认 `httpOnly: false`，因此不能把这条链路描述成依靠 HttpOnly 防护。
- 由于浏览器端 Supabase client 能访问会话，必须同时依靠 CSP、React 默认转义、禁止不可信 HTML 和依赖更新降低 XSS 风险。
- 所有状态变更 API 检查同源 `Origin`/`Host`，并依赖 SameSite Cookie 降低 CSRF 风险。
- 服务端只使用 publishable key 加用户会话访问偏好；`SUPABASE_SECRET_KEY` 不参与该路径。
- 日志只记录请求 ID、结果状态和脱敏邮箱摘要，不记录验证码、完整邮箱、Cookie、偏好全文或密钥。
- 前端错误不展示 Supabase 原始错误对象、内部表名或堆栈。
- Public Production 的 OTP 发送必须启用 CAPTCHA、共享限流和自定义 SMTP；页面倒计时只是体验控制，不是安全控制。

## 10. 稳定错误

| Code                      | HTTP | 含义               | 是否可重试 |
| ------------------------- | ---: | ------------------ | ---------- |
| `AUTH_EMAIL_INVALID`      |  400 | 邮箱格式无效       | false      |
| `AUTH_OTP_INVALID`        |  400 | 验证码错误或失效   | false      |
| `AUTH_RATE_LIMITED`       |  429 | 请求过于频繁       | true       |
| `AUTH_OTP_SEND_FAILED`    |  502 | 邮件服务发送失败   | true       |
| `AUTH_UNAVAILABLE`        |  503 | Auth 暂时不可用    | true       |
| `AUTH_REQUIRED`           |  401 | 当前操作需要登录   | false      |
| `PREFERENCES_INVALID`     |  400 | 偏好请求不符合契约 | false      |
| `PREFERENCES_UNAVAILABLE` |  503 | 偏好服务暂时不可用 | true       |

供应商消息只用于服务端受控映射。未知错误不得一律标成可重试；例如输入错误和验证码失效不应触发自动重试。

## 11. UI 与可访问性

- `/login` 使用现有 430px 小程序式画布、顶部标题栏、44px 输入和品牌蓝紫主按钮。
- 登录分为邮箱与验证码两步，同一时刻只突出一个主要动作。
- 验证码输入支持粘贴、数字键盘、清晰错误、重新发送和修改邮箱。
- 重新发送倒计时结束前禁用按钮，并通过 `aria-live` 宣布状态；倒计时不替代服务端限流。
- `/me/preferences` 初次加载显示骨架屏，失败显示可重试状态，不填入看似真实的默认云端数据。
- 保存成功使用 Toast；关闭长期记忆使用文案明确的 ConfirmDialog。
- 保存失败保留用户填写内容和焦点，避免要求重新填写。
- 页面明确标注“保存到 Supabase 云端，仅用于小智个性化；关闭后删除已保存偏好”。

## 12. 测试与验收证据

### 12.1 单元与契约测试

- 邮箱、OTP、`next` 和 Preferences Schema 的有效与无效边界。
- 安全 `next` 拒绝外部 URL、协议相对 URL、反斜杠和控制字符。
- 偏好部分更新、空数组清空、预算清空、去重和上限。
- 模型提案工具不调用 Repository。
- Repository 的读取、部分 upsert、删除和数据行 Zod 校验。
- 稳定错误映射不暴露供应商原始消息。

### 12.2 API 测试

- OTP 发送、验证、限流、非法 Body、请求体过大和安全响应头。
- 未登录 GET/PATCH 返回 `AUTH_REQUIRED`。
- API 忽略任何伪造身份的方案：`userId` 作为未知字段被拒绝。
- 首次授权生成服务端时间，后续更新保留授权时间并更新修改时间。
- 关闭长期记忆删除整行，重复关闭仍返回稳定成功状态。
- 数据库或 Auth 失败时不写浏览器 fallback。

### 12.3 RLS 集成测试

使用本地 Supabase 创建两个测试用户并获取各自会话：

1. 用户 A 能读取、更新和删除自己的偏好。
2. 用户 A 无法读取、更新或删除用户 B 的偏好。
3. 匿名角色不能读取或写入任意偏好。
4. service role 不参与普通偏好 API 的验证路径。

### 12.4 组件与 E2E

- 游客点击长期偏好后进入登录并保留安全 `next`。
- 本地 Supabase 使用邮件捕获界面 Mailpit 获取验证码，完成真实 OTP 登录。
- 登录后保存偏好、刷新页面仍能读取、登出后无法读取。
- 对话提案只有点击确认才写入；取消不写入。
- 关闭长期记忆后刷新仍显示未启用。
- 360、390、430px 无水平滚动，键盘、焦点和 `aria-live` 正常。

实现结束必须通过：

```bash
cd web
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

本地 Mailpit 测试只能证明本地链路。正式上线还必须用真实收件邮箱完成一次脱敏 smoke，不能拿本地测试替代在线结论。

## 13. 部署前置条件

代码实现和本地测试不要求先购买域名，但 Public Production 上线前必须完成：

1. 配置自有域名和 Supabase 允许的 Site URL / Redirect URL。
2. 配置自定义 SMTP、验证发件域名，并把模板改为包含 `{{ .Token }}`。
3. 启用 CAPTCHA，并在服务端验证 token。
4. 将单实例内存限流升级为适合 Vercel 多实例的共享限流。
5. 分别配置 Preview 与 Production 环境变量，不把密钥提交到 Git。
6. 用真实邮箱验证发送、验证码登录、刷新、登出、过期码和限流。

Supabase 默认邮件服务只适合开发验证，不作为公开面试版的生产邮件基础设施。

## 14. 面试表述

完成后可以诚实表述为：

> 公开业务允许游客浏览，个人偏好需要邮箱验证码登录。API 用 `auth.getUser()` 确定用户身份，并通过用户会话访问启用 RLS 的 `user_preferences`，所以客户端不能指定要修改谁的数据。模型只能生成偏好提案，真正写入必须由用户点击确认；撤销长期记忆会删除整行偏好。当前版本记录最近一次授权开始时间和更新时间，但不把它夸大成不可篡改的合规审计系统。

## 15. 参考资料

- [Supabase 邮件模板](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase 本地测试](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Supabase 自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
