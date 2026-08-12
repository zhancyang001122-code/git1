# Production 自定义域名验收报告

日期：2026-08-13

## 目标

为小智作品集提供不依赖 `vercel.app` 的正式访问入口，同时不移动或覆盖已被其他项目使用的根域名 `zaneyang.xyz`。

## 配置

- Production URL：`https://xiaozhi.zaneyang.xyz`
- Vercel Project：`xiaozhi-local-life`
- DNS 服务商：阿里云 DNS
- DNS 记录：`xiaozhi` / `A` / `76.76.21.21`
- TLS：Vercel 托管证书，自动续期
- Supabase Auth Site URL：`https://xiaozhi.zaneyang.xyz`

使用独立网站子域名，保留 `zaneyang.xyz` 及现有作品集项目的绑定不变。Vercel 当前把该 A 记录识别为有效配置；控制台给出的项目专属 CNAME 是可选优化，不是当前可用性的阻塞项。

## Redirect URL 决策（已被后续 Auth 决策取代）

本报告生成时的登录方案不是 Magic Link 或 OAuth callback，而是：

1. 服务端调用 `signInWithOtp({ email })` 发送 6 位验证码；
2. 用户在站内输入验证码；
3. 服务端调用 `verifyOtp({ email, token, type: "email" })` 建立会话；
4. 应用只接受经过白名单过滤的站内 `next` 路径。

该流程不发生 Supabase 邮件链接跳转，因此 Redirect URLs 留空是与当时实现一致的最小配置。作者随后于 2026-08-13 取消邮箱 OTP 与 SMTP，改用固定演示码映射隔离 Supabase 演示账号；当前实现与证据见 `docs/task-reports/2026-08-13-fixed-demo-auth.md`。后续如果增加 Magic Link、OAuth 或密码重置，再按实际 callback 路径添加精确白名单，不能预先放宽为通配符。

## 在线证据

- Cloudflare 公共 DNS、AliDNS 与阿里云权威 DNS 均解析到 `76.76.21.21`；
- `https://xiaozhi.zaneyang.xyz/api/health` 返回 HTTP 200；
- 健康检查显示 `mode=live`，Supabase、千问、高德与房源均为 `configured`；
- 自定义域名完成整套 `pnpm deploy:verify`：Live 健康检查、430px 移动布局、历史房源、高德、商业数据、偏好提案与反馈流程全部通过；
- GitHub 自动部署后的 Production deployment 保持 `READY` / `PROMOTED`。

## 当时仍未完成（后续决策已取消）

- 作者尚未确认 `AUTH_ALLOWED_EMAIL` 的目标收件邮箱；
- 尚未创建并验证 `auth.zaneyang.xyz` 发信域名；
- Supabase 尚未配置自定义 SMTP；
- 尚未用真实邮箱完成 OTP、偏好保存、退出和再次登录冒烟。

因此，本报告只证明自定义网站域名与 Live 应用链路可用，不把当时的邮件登录表述为已完成；这些邮件项后来不是“完成”，而是被作者从当前产品范围中明确取消。
