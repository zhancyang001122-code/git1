# 历史房源 PostGIS 数据层实施报告

日期：2026-08-12
Task：Supabase 历史房源云端接入 Task 1

## 结论

已在本地 Supabase 建立版本化历史房源数据层：数据分批导入期间保持不可见，只有行数验证完整的 release 才能事务性激活；浏览器角色不能直接读取新表，服务端通过受控 RPC 查询。当前没有修改远端 Supabase，也没有上传真实房源。

## 实现内容

- 启用位于 `extensions` schema 的 PostGIS。
- 新增 `housing_dataset_releases`，保存数据周期、来源、免责声明、预期/实际行数、校验和和激活状态。
- 新增 `historical_houses`，仅包含产品白名单字段；不包含 `raw`、联系方式、图片集合或内部自增 ID。
- 经纬度生成 WGS84 `geography(Point,4326)`，并建立 GiST 空间索引。
- 新增 `search_historical_houses`：只读取活动 release，支持价格、租赁类型、卧室数、半径、排序和受限分页。
- 新增 `activate_housing_dataset`：锁定目标 release、核对实际行数、归档旧版本并原子激活新版本。
- 两张表启用 RLS，不创建客户端策略，并显式撤销 `public`、`anon`、`authenticated` 权限。
- 两个 RPC 只授予 `service_role` 执行权限；Production 将使用服务端 `SUPABASE_SECRET_KEY`。

## 测试驱动证据

### RED

先扩展 `validate-migrations.mjs`，运行 `pnpm db:check` 得到预期失败：

```text
Error: Historical housing migration is missing
```

### 数据库验证

- `pnpm db:check`：PASS；13 个迁移、28 张表、全部表 RLS 覆盖。
- `supabase db reset`：PASS；从空数据库依次应用 13 个迁移，包括 PostGIS 和 migration 013。
- `pnpm db:test`：PASS；1 个 pgTAP 文件、26 项测试全部通过。
- `supabase db lint --level warning`：命令退出 0。本次两个 `public` 函数没有被报告；输出包含 PostGIS 扩展内部动态 SQL 的已知静态分析噪音，以及既有 `publish_kb_version` 的 enum/text 告警，未在本 Task 扩大范围修改。

pgTAP 实际覆盖：

- 表、字段、禁用字段和 RLS 状态。
- anon/authenticated 无直接读取权限，service role 有权限。
- 未激活 release 不可查询。
- 完整 release 激活及实际行数记录。
- 价格、卧室数、租赁类型和半径筛选。
- PostGIS 距离排序和同点距离。
- 分页前总数、结果上限和非法参数拒绝。
- 非正租金约束。

第一次真实 pgTAP 发现 RPC 的 `smallint` 输入无法匹配普通整数参数；已将 RPC 输入改为 `integer`，表内仍使用 `smallint`，随后 reset 和 26 项测试全部通过。

### Web 质量门禁

- `pnpm lint`：PASS。
- `pnpm typecheck`：PASS。
- `pnpm test`：PASS；104 个文件、375 项测试。
- `pnpm build`：PASS；Next.js 16.3.0，42 个静态页面生成步骤完成。

全量测试期间发现并单独修复一个既有随机测试问题：Cookie 篡改测试偶尔用与原字符相同的 `x`，导致实际未篡改。修复提交为 `37b75d1 test(conversation): make cookie tamper case deterministic`，不涉及生产逻辑。

## 当前边界

- 新表为空；活动历史房源 release 尚不存在。
- 远端 Supabase migration 013 尚未执行。
- 应用仍使用现有 Demo/本机 HTTP 路径。
- 下一 Task 先实现只读 SQLite 清洗和导入器，并执行 dry-run；在容量和安全字段验证前不写远端。
