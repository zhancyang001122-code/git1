# Supabase 多实例共享限流证据

日期：2026-08-12

## 结论

Production 的 Chat、Feedback、公开 Knowledge Search、地图直连和受保护的知识评测已从单实例内存计数升级为 Supabase 原子固定窗口计数。所有 Vercel 实例共享同一计数边界；Demo 仍使用内存实现，保持无外部依赖。

这项改造不改变用户确认过的 Auth 取舍：低频单邮箱 OTP 不增加 CAPTCHA，仍明确不适用于公众注册。

## 安全与一致性

- 主键是 `scope + key_hash + window_start`，RPC 使用 `INSERT ... ON CONFLICT DO UPDATE` 原子加一，并返回 `allowed`、`remaining` 和 `retry_after_seconds`。
- 应用使用 `ANONYMOUS_COOKIE_SECRET` 对 `scope + 客户端键` 执行 HMAC-SHA256；数据库只保存 64 位摘要，不保存原始 IP，也不能在没有服务端密钥时离线枚举 IPv4。
- `api_rate_limit_windows` 启用 RLS，没有匿名或登录用户 Policy；RPC 撤销 `public`、`anon` 和 `authenticated` 权限，只允许 `service_role`。
- Live 的共享后端或返回契约异常时返回稳定 503，成本敏感接口失败关闭；不会静默退回无限放行。
- 过期窗口由 RPC 机会式清理，不保留长期客户端轨迹。
- Knowledge Search 新增 8 KiB 实际 UTF-8 请求体上限，避免在 Zod 校验前无界解析 JSON。
- 地图直连新增 8 KiB 上限和每分钟 30 次共享窗口；知识评测先完成管理员鉴权，再进入每分钟 10 次共享窗口。候选草稿、评测与回滚也在 JSON 解析前执行与合法 Schema 容量匹配的字节上限。

## Production 证据

- 远端 migration：`202608120022_distributed_rate_limits.sql` 已应用。
- Vercel deployment：`dpl_CUmNkiFsugHEPuQsauoQtxmkrCEG`，状态 `READY`，已绑定 `https://xiaozhi-local-life.vercel.app`。
- 使用 publishable/anon Key 调用 RPC 被拒绝。
- service-role 在测试作用域按限制 2 连续调用三次，结果为 `允许/剩余1 → 允许/剩余0 → 拒绝/剩余0`，`retry-after` 在窗口内。
- 验证结束后只删除了 `verification_rate_limit` 的 1 条测试窗口，未触碰业务数据。
- Production 公开 Knowledge Search 返回 HTTP 200，并在 `knowledge_search_ip` 作用域生成 64 位摘要共享计数。
- Production 地图直连接口返回 HTTP 200 和 `mode=live`；随后在 `maps_nearby_ip` 作用域读取到 64 位摘要、计数 1。该次关键词结果为 0，因此只作为直连与共享计数证据，不冒充 POI 命中证据。
- Production 使用恶意 Origin 和无效随机 ID/占位 token 调用 Feedback 与管理登录，均在业务状态加载前返回 HTTP 403 `AUTH_ORIGIN_INVALID`；未使用真实管理口令，也未创建反馈或候选。
- 部署后完整 Live 回归通过：健康状态、移动布局、房源、高德、商品、偏好提案与反馈闭环均正常。

## 全量质量门禁

- migration 静态检查：22 个 migration、30 张表，全部表具备 RLS 覆盖。
- pgTAP：6 个文件、121 项测试通过。
- 真实权限边界：17 项 SQL Role RLS、14 项 PostgREST/JWT 检查通过。
- Vitest：116 个测试文件、459 项测试通过。
- TypeScript strict、ESLint、Prettier 和 Next.js Production build 通过。
- Playwright：47 项通过；本机 OTP 与本机 HTTP 房源两个专项用例因默认环境未配置而按设计跳过。

## 仍保留的边界

- 管理发布、索引 Worker 与 OTP 仍使用单实例应用层窗口；它们另有管理口令、Cron secret 或单邮箱白名单，适合当前低频面试演示。
- 如果未来开放公众注册、开放式 API 或高流量租户，需要增加边缘 WAF、套餐/租户配额、共享 OTP 限流、CAPTCHA 风险策略和专用 Redis/Upstash，而不是只扩大当前计数阈值。
