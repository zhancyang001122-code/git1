# 社交平台租房线索交付记录

日期：2026-09-03  
Production 功能提交：`7ab3df71a114afdfcaf693d4d3eb9aeb0f5143ae`

## 交付结果

- `/houses` 使用互斥页签区分 `2024 历史房源` 与 `近期租房线索`。
- 近期线索默认使用共享定位按 WGS84 直线距离排序，支持租金区间、户型筛选和分页。
- `/houses/[id]` 展示来源平台、发布时间、来源状态与去除追踪参数后的 canonical 原帖链接。
- 社交线索不展示无法取证的“问小智”或模拟预约按钮。
- 原始采集数据留在仓库外；Supabase 不保存昵称、联系方式、原始正文、图片、临时 token 或 Cookie。

## 首批数据证据

- 输入 40 条，去重后 40 条，120 天窗口内 26 条。
- 取消模型置信度硬门槛后，7 条进入人工复核。
- 4 条批准，3 条拒绝：2 条疑似模板化获客，1 条没有具体站点、小区或地标。
- Production RPC 返回 4 条；`2000 元以内`返回 3 条。
- 高德先调用[地点搜索 2.0](https://lbs.amap.com/api/webservice/guide/api/newpoisearch)解析小区、地标或站点，并用帖子区名消歧；无 POI 时才回退地理编码。

## 数据库与权限证据

- 新增 `social_housing_ingest_batches`、`social_housing_leads`、`social_housing_lead_sources` 三表。
- 三表启用 RLS，`anon` 与 `authenticated` 无直接读取权限；浏览器只能经服务端 API 和 service-role 专用 RPC 读取已批准线索。
- 数据库 schema 检查确认敏感字段计数为 0。
- 外键索引 `social_housing_sources_batch_idx` 已在 Production 存在；Supabase 性能顾问不再报告本模块未索引外键。
- 本地与远端迁移版本均为 `20260903032721`、`20260903033400`，避免后续迁移漂移。

## 自动化验证

- `pnpm format:check`：通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：145 个文件、613 个测试通过。
- `pnpm db:check`：32 个迁移、36 张表及全部 RLS 覆盖通过。
- `pnpm db:test`：10 个文件、236 个 pgTAP 测试通过。
- `pnpm build`：Next.js Production 构建通过。
- `pnpm test:e2e`：54 个通过、1 个按环境条件跳过。
- `pnpm deploy:verify-production`：Live 健康、首页、案例页、移动端布局、近期线索列表与来源详情、房源、地图、商品、偏好提案和反馈链路全部通过。

## 诚实边界

- `approved` 只表示通过本项目展示审核，不证明发布者身份、当前房态、租金或合同真实。
- 当前只有小红书首批样本；抖音只有表结构与 URL 契约，尚未形成已验证采集批次。
- MediaCrawler 依赖人工扫码登录和低频本机运行，不是无人值守生产采集服务。
- 当前 Agent 没有社交线索查询工具，因此小智不会声称已经读取这些帖子。
