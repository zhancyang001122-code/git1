# Production 管理会话验收

日期：2026-08-12

## 结论

Production 已配置机器生成的 256-bit 随机 `DEMO_ADMIN_TOKEN`，并完成知识运营管理页的真实登录和退出闭环。口令在 Vercel 中为不可回读的 Sensitive 环境变量；本机副本保存在 Windows 凭据管理器，不进入 Git、`.env.local`、URL、日志或浏览器脚本。

## 安全边界

- 登录表单仅接受 `application/x-www-form-urlencoded`，请求体在解析前限制为 4 KiB。
- 登录、Feedback 及使用管理 Cookie 的写操作强制 Same-Origin；Bearer 管理自动化保留独立权限边界。
- 管理 Cookie 使用 `HttpOnly + Secure + SameSite=Strict + Path=/`，有效期 4 小时。
- 同源保护的主动退出路由使用相同 Cookie 属性和 `Max-Age=0` 清除会话。
- Windows 凭据辅助脚本不含口令：`store-admin-token.ps1` 从标准输入保存，`copy-admin-token.ps1` 只复制到剪贴板而不在终端打印明文。

## Production 证据

- Vercel deployment：`dpl_75dQvTqybXELCyeNWDw7TkrKZriU`，状态 `READY`，已绑定 `https://xiaozhi-local-life.vercel.app`。
- `DEMO_ADMIN_TOKEN` 的 Production 类型为 Sensitive，Vercel Dashboard/CLI 不可回读其值。
- 自动化从 Windows 凭据管理器临时读取口令，只注入当前验证子进程；结束后清空环境变量和剪贴板。
- 在线闭环通过：未登录访问重定向到登录页 → 正确口令登录 → AI Ops 站内告警和跨实例工具审计可见 → Cookie 属性符合要求 → 主动退出 → Cookie 消失 → 再次访问重新受保护。
- Production 跨源 Feedback 和管理登录均返回 HTTP 403 `AUTH_ORIGIN_INVALID`；使用无效随机 ID/占位 token，未产生业务写入。

## 作者使用方法

在 `web/` 目录运行：

```powershell
.\scripts\copy-admin-token.ps1
```

脚本只把口令复制到剪贴板。粘贴到 `/knowledge-admin/login` 后立即运行：

```powershell
Set-Clipboard -Value $null
```

如果轮换口令，必须用同一新值同时覆盖 Windows 凭据和 Vercel Production Sensitive 变量，再重新部署并运行 `pnpm knowledge:verify-admin-production`。不要把口令发进聊天、提交到 Git 或写入截图。
