# 跨实例工具审计与站内告警证据

日期：2026-08-12

## 结论

Production 已支持从 Supabase 集中检索所有 Vercel 实例写入的终态工具审计，并计算四类站内阈值状态。该能力解决了“单进程 Map 无法跨实例”的工具级观测问题，但不等于完整企业监控：全部 Route 日志、外部通知、事故认领和值班升级仍未接入。

## 安全边界

- `search_ai_tool_run_logs` 只返回工具名、终态、来源、耗时、错误码、`requestId` 和时间。
- RPC 不返回 `input_json`、`output_summary`、对话正文、完整 Prompt、Cookie 或密钥。
- 工具名只允许小写白名单格式并执行精确匹配；状态只允许 `succeeded`、`failed`、`timed_out`。
- 两项 RPC 均撤销 `public`、`anon` 和 `authenticated` 执行权，只授权 `service_role`。
- 管理页仍受独立 HttpOnly 管理会话保护；Production 尚未配置用户自选管理口令，因此不能声称页面登录已在线验收。

## 阈值

| 信号           | 告警条件                                      | 最小样本      |
| -------------- | --------------------------------------------- | ------------- |
| 工具失败率     | 失败或超时 > 5%                               | 20 次终态调用 |
| RAG 零结果率   | 成功但零结果 > 20%                            | 10 次检索     |
| 知识索引积压   | 失败任务，或租约过期/可执行后等待超过 15 分钟 | 无            |
| RAG 评测失败率 | RAG/拒答案例失败 > 10%                        | 5 次评测      |

样本不足返回 `insufficient_data`，不会伪装成 `ok`。

## Production 在线证据

- Supabase migration `202608120021_ai_ops_alerts.sql` 已应用远端。
- Vercel Production deployment：`dpl_6iodosDYqZLARBLuMBFy9SK13L52`，状态 `READY`，已绑定 `https://xiaozhi-local-life.vercel.app`。
- 线上 RPC 返回 5 条最近跨实例工具记录，确认没有 `input_json` 或 `output_summary` 字段。
- 线上 24 小时阈值快照：索引积压 `ok`；RAG 零结果与评测为 `insufficient_data`；工具失败率 10.26%，样本 78，真实触发 `alert`。
- 失败记录按安全字段聚合为 8 次：`search_products` 参数错误 3 次、偏好值错误 2 次、商品执行失败 1 次、高德参数错误 1 次、高德超时 1 次。这些主要来自当日受控 Production 回归与模型参数修复过程，但仍是真实质量信号，因此没有通过调高阈值掩盖。
- 部署后完整 Live 验证再次通过：健康状态、移动布局、历史房源、高德、商品、偏好提案与反馈闭环均通过。

## 质量门

- Vitest：115 个测试文件、438 个测试通过。
- pgTAP：5 个测试文件、103 个测试通过。
- SQL Role RLS：17 条边界检查通过。
- PostgREST JWT：14 条 HTTP 权限检查通过。
- Playwright：47 条通过，2 条按专项环境条件跳过。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm format:check` 全部通过。

## 未完成

- Production 管理口令及受保护页面在线登录验收。
- 全部 Route 级跨实例日志和首 Token P95。
- 单会话成本阈值。
- 飞书、邮件、Slack、短信或 PagerDuty 外发，事故认领和值班升级。
