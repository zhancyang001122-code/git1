# Auth 与长期偏好本地验证报告

**日期：** 2026-08-12

**分支：** `codex/housing-http-adapter`

**结论：** 本地 Supabase Auth、用户会话、偏好 API、RLS 与浏览器流程已通过；Public Production Auth 尚未完成。

## 1. 已交付范围

- `/login`：邮箱与 6 位 OTP 两阶段登录、错误保留、重发倒计时和安全返回路径。
- `POST /api/auth/otp/send`、`POST /api/auth/otp/verify`、`POST /api/auth/sign-out`。
- Next.js `proxy.ts` 会话刷新；业务 API 仍逐次使用 `auth.getUser()` 验证用户。
- `/me/preferences`：服务端登录保护、真实云端读取、显式授权保存、更新时间展示和整行撤销。
- `GET/PATCH /api/preferences`：严格 Zod 契约、同源检查、请求体限制、稳定错误与 RLS 用户会话访问。
- `propose_user_preference`：只生成待确认提案，不写数据库；界面确认后才调用 Preferences API。
- 登出只清除当前会话，不伪装成删除偏好。

## 2. 数据与权限边界

```text
Browser
  -> Auth / Preferences Route Handler
      -> auth.getUser() 获取可信用户 ID
          -> 用户会话 Supabase client
              -> user_preferences RLS (user_id = auth.uid())
```

- 客户端请求不能提交 `userId` 或 `consentedAt`。
- Preferences API 不使用 service role 绕过 RLS。
- 首次授权时间由服务端生成；已授权更新保留原授权时间。
- 关闭长期记忆执行整行删除。
- 提案结果在模型上下文中标记为 `saved: false` 和 `requiresUserAction: true`，不进入已保存事实集合。

## 3. 本地验证证据

本地目标为仓库 `project_id = "xiaozhi-supabase"` 的 Docker Supabase；不连接或重置线上项目。

### 3.1 迁移

执行本地 `supabase db reset --local --no-seed`，以下迁移从空库顺序应用成功：

- `202608050001` 至 `202608050010`
- `202608110011`
- `202608120012`

### 3.2 SQL Role RLS

命令：

```powershell
cd web
pnpm db:verify-rls
```

结果：16 项角色边界全部通过，包括：

- 匿名不能读写 `user_preferences`。
- 用户 A 能读、写、更新、删除自己的偏好。
- 用户 B 看不到、不能更新、不能删除用户 A 的偏好。
- service role 仅用于独立验证 server-only AI 日志，不参与 Preferences API 路径。

### 3.3 PostgREST/JWT RLS

命令：

```powershell
pnpm db:verify-http
```

结果：14 项 HTTP 边界全部通过。脚本通过本地 Auth Admin 创建隔离身份，并在 `finally` 中删除测试用户；不依赖 SQL 脚本残留数据。

### 3.4 Auth 与 Preferences API

在使用本地 Supabase 环境启动的 Next.js 生产服务器上执行：

```powershell
pnpm auth:verify-local
```

结果：

1. 应用 API 请求 OTP。
2. Mailpit 捕获含 6 位 Token 的自定义模板。
3. 应用 API 验证 OTP 并设置会话 Cookie。
4. 登录用户读取空偏好。
5. 登录用户授权并保存偏好。
6. 新请求仍能读取已保存偏好。
7. 撤销后返回无偏好状态。
8. 登出成功。
9. 登出后读取偏好返回 401。

脚本不会输出邮箱、OTP、Cookie、会话 Token 或完整偏好 Payload。

### 3.5 Chromium 用户流程

命令：

```powershell
pnpm test:e2e:auth
```

结果：1 个完整 Auth 专项用例通过，覆盖：

- 未登录访问偏好页跳转登录。
- 从 Mailpit 获取 OTP 并登录。
- 保存偏好后刷新仍存在。
- 对话提案取消后偏好不变。
- 对话提案确认后只更新目标字段。
- 撤销后刷新仍为未启用。
- 登出后匿名确认提案返回登录页。

### 3.6 全量回归

- `pnpm format:check`：通过；生成的 `pnpm-lock.yaml`、构建目录和测试报告已排除，避免格式化工具改写生成物。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：104 个测试文件、375 个测试全部通过。
- `pnpm build`：通过，`/login`、`/me/preferences` 与 Auth/Preferences API 均进入生产路由清单。
- 默认 Demo Playwright：47 个通过、2 个按环境明确跳过；Auth 专项不在 Demo 环境重复运行。
- Auth 专项 Playwright：1 个完整 Chromium 流程通过。

## 4. 验证过程中发现并修复的问题

1. 本地 Auth 容器未加载新邮件模板：重启本地 Supabase 后确认模板包含 `{{ .Token }}` 的实际 6 位值。
2. Next 生产服务器会规范化内部 `request.url` 主机名：同源检查补充可信 `Host` 与转发协议比较，仍拒绝外站 Origin。
3. 登出后的 `refresh_token_not_found` 原先被误报为 Auth 503：现在只把缺失/无效刷新会话归为未登录，真实供应商或网络故障仍返回 503。

## 5. 尚未完成，禁止对外宣称

- 未配置生产域名和自定义 SMTP。
- 未验证生产发件域名和真实邮箱送达率。
- 面试演示版本明确不使用 CAPTCHA 或共享限流；Production 只允许 `AUTH_ALLOWED_EMAIL` 指定的作者邮箱。该取舍不适用于公众注册或高流量产品。
- OTP API 当前应用层限流为单实例内存实现，公开公众注册前必须升级；当前单邮箱演示还依赖 Supabase 供应商限流作为第二道边界。
- 未完成生产环境的过期码、重发、限流和邮件退信冒烟。
- 本报告不证明高德、千问、正式 RAG 材料或线上房源业务链路已接通。

## 6. 面试可诚实表述

> 我把公开浏览和个人数据分开：面试官可以匿名浏览，只有作者白名单邮箱能通过 Supabase OTP 登录并使用云端长期偏好。发送和验证接口都校验白名单，Production 漏配时安全停用；登录后服务端再用 `auth.getUser()` 与 RLS 隔离数据。模型只能生成待确认提案，真正写入必须由用户点击。因为它是低频作品演示，我没有堆 CAPTCHA 和共享限流，也不会把这个取舍包装成公众注册系统；生产真实邮箱送达仍要做冒烟验证。
