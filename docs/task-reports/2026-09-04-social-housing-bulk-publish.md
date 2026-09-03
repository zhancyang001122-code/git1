# 社交租房线索批量发布记录

日期：2026-09-04

## 发布结果

- 作品集所有者明确批准发布累计审核队列中的 101 条候选。
- 发布前 dry-run 核对为 101 条审核、101 条批准、0 条遗漏、0 条额外记录。
- 幂等导入完成后，Supabase 有 105 条带来源的已批准线索；正式 `/api/housing-leads` 返回 `total: 105`，首屏 24 条，下一页游标为 `offset:24`。
- 101 条没有简单叠加为 105 + 101；平台帖子 ID 和房源 dedupe key 会合并已存在来源。
- 删除了 1 条精确确认没有任何来源的旧孤立主记录 `7508a0c7-a5a9-437f-83cb-f3c643b07f78`，其余 105 条未受影响。

## 后续自动发布策略

`pnpm housing:social-publish` 只处理已经通过以下门槛的累计候选：

1. 规则排除求租、攻略、已租和明显商业获客。
2. `qwen3.7-plus` 结构化抽取通过 Zod 契约。
3. 租金、地点和有效性字段满足准入规则。
4. 高德返回可用于距离排序的坐标。
5. 平台与帖子 ID 去重，并执行第二层房源级去重。

脚本在本机保存 `auto-decisions.json`，来源记录的 `extractor_version` 标记 `policy-approved`。自动批准只表示通过作品集展示规则；前端继续显示“房态未经核验”，用户仍需打开来源帖核验实际房态。

## 安全边界

- Supabase secret key 只在服务端脚本使用，没有写入浏览器或仓库。
- 原始正文、联系方式、昵称、Cookie、临时 Token 和媒体文件不上传 Supabase。
- 数据表继续启用 RLS，公开页面只通过服务端 RPC 读取已批准且有来源的 120 天内记录。

## 最终验证

- Supabase：105 条主记录、105 条来源记录、105 个唯一平台帖子 ID、0 条孤立记录。
- 审计标记：101 条为 `qwen3.7-plus-structured-v2-owner-approved`，原有 4 条保留原提取版本。
- 正式 API：`total: 105`，首屏 24 条，下一页游标 `offset:24`。
- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、145 个文件共 621 项测试、`pnpm db:check` 和 `pnpm build` 全部通过。
- `pnpm deploy:verify-production` 通过正式健康、首页、案例、移动布局、租房线索、地图、交易、偏好和反馈链路。
