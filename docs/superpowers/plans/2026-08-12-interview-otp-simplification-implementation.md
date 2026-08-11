# 面试演示 OTP 简化实施计划

**目标：** 删除 CAPTCHA 分支，以单个服务端演示邮箱白名单收紧公开 OTP 登录，同时保持现有 Supabase 会话和 RLS 链路。

## 任务

1. 先更新 Schema、环境契约、Auth Runtime、发送与验证路由测试，使其表达新边界并确认失败。
2. 新增可复用的邮箱白名单校验，发送与验证路由共同调用。
3. 删除 `captchaToken`、`AUTH_CAPTCHA_REQUIRED` 及相关错误和测试分支。
4. 为本地 Auth E2E 和验证脚本设置专用测试邮箱，不记录真实邮箱或 OTP。
5. 更新环境示例、API 契约、验收标准和 Auth 验证报告。
6. 运行格式、Lint、类型、单元测试、构建、Auth E2E、RLS 与 HTTP 验证。
7. 使用 Conventional Commit 提交并推送。
