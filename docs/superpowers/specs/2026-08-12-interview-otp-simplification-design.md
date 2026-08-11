# 面试演示 OTP 简化设计

**日期：** 2026-08-12

## 决策

小智是公开可浏览、由作品作者现场操作登录的面试演示项目。验证码继续使用 Supabase 邮箱 OTP，不接入 CAPTCHA、Redis 或第二套验证码供应商。

线上 Auth 通过服务端环境变量 `AUTH_ALLOWED_EMAIL` 只允许一个演示邮箱。发送验证码与验证验证码两个接口都执行相同白名单检查，避免只保护发送接口而留下验证绕过。Production 未配置白名单时登录安全停用；非 Production 环境可省略白名单，方便本地开发。

## 保留的安全边界

- 状态变更接口继续校验同源请求、请求体大小和 strict Zod Schema。
- OTP 发送继续按客户端和邮箱执行现有轻量限流。
- 非白名单邮箱不会调用 Supabase Auth。
- 登录成功仍由 Supabase 会话 Cookie、`auth.getUser()` 和 RLS 共同保护用户数据。
- 普通访问者无需登录即可浏览公开作品内容。

## 明确不做

- 不保留 `captchaToken` 请求字段或 `AUTH_CAPTCHA_REQUIRED` 配置。
- 不引入 CAPTCHA、共享限流服务或新的短信/邮件验证码供应商。
- 不把此方案描述为高流量、多租户企业 Auth；若以后开放公众注册，应重新评估 CAPTCHA、共享限流、自定义 SMTP、审计与滥用监控。

## 验收

1. 白名单邮箱可以发送并验证 OTP。
2. 非白名单邮箱在发送和验证阶段都被拒绝，且不会调用 Supabase。
3. Production 缺少 `AUTH_ALLOWED_EMAIL` 时 Auth 返回稳定的不可用错误。
4. Auth 请求与 Supabase 调用不再包含任何 CAPTCHA 字段。
5. 本地真实 OTP、会话、Preferences、RLS 和浏览器流程继续通过。
