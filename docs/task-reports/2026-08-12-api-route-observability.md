# API Route 跨实例安全日志

## 目标

把所有 Next.js API Route 的状态和耗时写入 Supabase，跨 Vercel 实例集中查询，同时不把请求内容或用户隐私复制进日志系统。

## 实现

- 21 个 `route.ts` 文件、23 个 HTTP 方法统一使用 `observeRoute()`。
- Next.js `after()` 在响应完成后异步持久化，不延长业务响应的关键路径。
- `api_route_logs` 仅保存：静态路由键、HTTP 方法、状态码、耗时、`requestId`、稳定错误码和创建时间。
- 明确不保存：查询参数、请求正文、Cookie、Authorization、IP、响应正文、完整异常或 Prompt。
- Live 模式写 Supabase；Demo 模式不伪装成跨实例持久化。
- 写日志失败采用 fail-open，只输出稳定错误码，不把正常业务请求改成失败。
- 表启用 RLS，客户端没有策略与权限；插入和查询仅授权 `service_role`。
- 管理页登录后可按 HTTP 方法和 2xx–5xx 状态类查询最近记录。
- 自动覆盖测试扫描所有 API Route；新增方法未包装时测试失败。

## 验证

- Vitest 覆盖安全字段、异常路径、持久化失败、Repository 参数边界、全部 Route 覆盖和管理 UI。
- pgTAP 覆盖表、RLS、角色权限、查询 RPC、筛选和数据库约束。
- Production 部署后需要分别触发成功与错误请求，再从受保护管理页或服务端 RPC 核对同一个 `requestId`。

## 仍未完成

这不是完整企业告警平台。外部通知、事故认领、通知接收人和值班升级需要真实团队和长期平台选择，继续保留为外部输入项。
