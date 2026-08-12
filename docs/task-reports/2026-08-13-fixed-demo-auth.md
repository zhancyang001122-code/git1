# 固定演示码 Auth 验收报告

日期：2026-08-13

## 决策

作者明确取消真实邮箱验证码、自定义 SMTP 和发件域名服务，改用公开固定演示码 `666666`。该值在产品和文档中称为“演示码”，不称为 OTP、验证码或真实用户认证。

## 实现边界

- 浏览器只提交 `code` 与经过过滤的站内 `next`；
- 服务端只接受 `666666`，并执行 Same-Origin、4 KiB Body 上限和轻量限流；
- 固定码映射到独立的 Supabase 演示用户 `demo@auth.zaneyang.xyz`；
- Supabase 随机密码使用 256-bit CSPRNG 生成，只保存在 Vercel Production Sensitive 环境变量；
- 页面、API、日志、Git 与浏览器均不返回演示用户邮箱或密码；
- 登录仍由 Supabase `signInWithPassword()` 签发真实 Session Cookie，授权仍依赖 `auth.getUser()` 和 RLS；
- 演示账号由体验者共享，页面明确警告不要填写真实隐私，并允许删除整行长期偏好。

## 被删除的能力

- `/api/auth/otp/send`；
- `/api/auth/otp/verify`；
- 邮箱白名单 `AUTH_ALLOWED_EMAIL`；
- 当前范围内的 SMTP、发件域名和真实收信验收。

历史 Mailpit OTP 报告保留，用于说明项目演进，不代表当前运行路径。

## 当前证据

- Auth、API、UI 与环境契约定向测试：43 项通过；
- 全量 Vitest：125 个文件、517 项通过；
- Next.js Build：43 条页面/API 路由，旧 OTP 路由不存在；
- 本地真实 Supabase 浏览器 E2E：固定码登录、Session、RLS 偏好保存、退出、重新登录、跨会话持久化与最终删除全部通过；
- 默认作品集 E2E：48 项通过、1 项按环境条件跳过；复合房源、周边和规则请求按三段工具链完成；
- 远端隔离 Supabase 演示用户已创建；
- Vercel Production 已保存 `DEMO_AUTH_EMAIL` 与 `DEMO_AUTH_PASSWORD` 为 Sensitive，随机密码未输出。

## Production 在线证据

- GitHub 提交 `969da0f` 触发 Vercel 自动部署，GitHub Deployment 状态为成功；
- 自定义域名登录页已部署固定演示码与共享账号提示；
- 固定码在线建立真实 Supabase Session，错误演示码返回 400；
- 登录后偏好保存成功，退出后读取返回 401，再次登录后可读取持久化数据；
- 验证流程最终关闭长期记忆、删除共享偏好并退出，没有留下测试偏好；
- 同一部署的 Production Live 健康、移动布局、历史房源、高德、商业数据、千问偏好提案与反馈回归全部通过；
- 验证日志没有输出服务端账号密码、Cookie 或完整偏好载荷。

该方案是低频作品集取舍。若转为真实用户产品，应使用邮箱、OAuth 或企业 SSO 等真实身份，并重新设计账号隔离、找回、审计和防滥用。
