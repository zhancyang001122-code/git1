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
- 本地门禁：Vitest 120 个文件、472 条测试；pgTAP 7 个文件、140 条测试；Playwright 47 条通过、2 条按外部环境跳过；ESLint、TypeScript 和 Production Build 通过。
- 远端迁移：`202608120023_api_route_logs.sql` 已应用。
- Production 最终部署 `dpl_3xdDgGYhM6nFZErBgQ7Rdmsw9aqM` 为 READY，并绑定 `https://xiaozhi-local-life.vercel.app`。
- Production 成功请求 `82000000-0000-4000-8000-000000000001` 在 Supabase 中记录为 `GET /api/health`、200、22ms。
- Production 错误请求 `82000000-0000-4000-8000-000000000002` 在 Supabase 中记录为 `POST /api/maps/nearby`、400、668ms、`INVALID_MAP_REQUEST`。
- 最终部署请求 `83000000-0000-4000-8000-000000000001` 在 Supabase 中记录为 `GET /api/health`、200、44ms，证明响应完成后计算耗时的修正已上线。
- `pnpm deploy:verify-route-logs -- <requestId...>` 可使用本机服务端环境变量复验指定请求，只输出白名单日志字段。

## 仍未完成

这不是完整企业告警平台。外部通知、事故认领、通知接收人和值班升级需要真实团队和长期平台选择，继续保留为外部输入项。
