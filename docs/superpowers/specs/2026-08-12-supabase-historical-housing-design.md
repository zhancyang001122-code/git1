# Supabase 历史房源云端接入设计

日期：2026-08-12
状态：已完成方案确认，等待书面评审
适用范围：2024-11 杭州租房历史快照、小智房源列表与 `search_houses`

## 1. 背景与目标

当前项目已经能够通过 `HousingHttpAdapter -> FastAPI -> SQLite` 在本机查询 60,202 条历史房源，但 Vercel 无法访问用户电脑。用户已确认数据具有公开使用授权。

本阶段目标是把经过清洗的安全字段导入现有 Supabase 项目，让 Vercel 上的房源列表和小智工具使用同一份云端历史数据，同时保持以下事实边界：

- 数据是 `2024-11` 历史快照，不是实时在租数据。
- 原始数据没有行政区和详细地址字段；缺失值保持未知。
- 不上传 `raw`、联系方式、图片集合、内部自增 ID 等非必要字段。
- 浏览器不直接读取房源表，也不接触 Supabase secret key。

## 2. 已核验的数据现状

只读审计结果：

- 原始 SQLite：117,104,640 bytes。
- `listings`：60,202 行。
- `city`、`price`、`lat`、`lng`、`url`、`source`、`external_id`：60,202 行均有值。
- `title`、`rent_type`、`layout`、`community`：各缺失 438 行。
- `area`：缺失 453 行。
- `district`、`address`：60,202 行全部缺失。

上述缺失数据不会通过模型、默认值或演示数据补造。

## 3. 方案比较与决定

### 方案 A：Supabase 独立历史房源表与受控查询函数（采用）

创建 `historical_houses` 和数据版本表，通过 PostGIS 索引及只读 RPC 查询。Vercel API 使用服务端 Supabase secret 调用 RPC，浏览器只调用 Next.js API。

优点：与当前架构一致；不需要单独服务器；页面和 Agent 共用事实源；RLS、版本发布、索引和测试证据适合作品集讲解。缺点：需要一次清洗导入，并管理 Supabase 免费容量。

### 方案 B：复用现有 `houses` 表（不采用）

现有 `houses` 强制要求 `district`、`address`、`available` 等字段，但真实数据缺少这些事实。复用会迫使系统填写虚假默认值，并把 11 条演示房源和 60,202 条真实历史记录混在同一数据模型中。

### 方案 C：继续部署 FastAPI + SQLite（不采用为生产路线）

现有 HTTP 契约和只读实现可继续作为本地原型证据，但公网需要额外托管、鉴权、健康检查和跨服务运维。既然数据允许进入 Supabase，该复杂度没有必要。

## 4. 总体架构

```text
本机 SQLite（只读原始来源）
  -> 导入器：校验、脱敏、规范化、确定性 ID、校验和
  -> Supabase historical_houses（未激活数据版本不可查询）
  -> search_historical_houses RPC（固定字段、固定筛选、固定上限）
  -> HistoricalHousingSupabaseAdapter（Zod 校验响应）
  -> application service / Business tool
  -> Next.js API、房源页面、小智结果卡
```

`HousingSearchService` 继续作为端口，调用方不依赖 PostGIS 或表结构。`HousingHttpAdapter` 只保留为本地原型和迁移回归基线，不进入 Vercel Production 路径。

## 5. 数据模型

### 5.1 `housing_dataset_releases`

用于避免分批导入期间出现“半份数据可见”。字段包括：

- `id uuid primary key`
- `dataset_period text unique`，本次为 `2024-11`
- `source_label text`
- `disclaimer text`
- `status text`：`importing | active | failed | archived`
- `expected_count integer`
- `imported_count integer`
- `content_checksum text`
- `activated_at timestamptz null`
- `created_at`、`updated_at`

同一时刻只允许一个 `active` 数据版本。RPC 只查询活动版本。

### 5.2 `historical_houses`

仅保存产品实际需要的安全字段：

- `id uuid primary key`：由 `dataset_period + source + external_id` 生成 UUIDv5，重复导入保持一致。
- `release_id uuid not null`
- `source_key_hash text not null`：原始来源键的 SHA-256，不公开原始内部 ID。
- `title text null`
- `city text not null`
- `district text null`
- `address text null`
- `community text null`
- `price_monthly integer not null`
- `rent_type text null`
- `layout text null`
- `bedrooms smallint null`：只从可识别的户型文本确定性解析。
- `area_sqm numeric(7,2) null`
- `floor text null`
- `orientation text null`
- `longitude numeric(10,6) not null`
- `latitude numeric(9,6) not null`
- `location geography(Point,4326)`：由经纬度生成。
- `source_url text null`：只允许合法 `http/https`。
- `dataset_period text not null`
- `is_historical boolean not null default true`
- `created_at timestamptz`

不创建无法由历史快照证明的实时可用状态或其他缺失字段；Live 房源只提供可验证的筛选条件。领域模型使用：

```text
availability: "historical_unknown"
district/address: null
```

## 6. 查询与权限

### 6.1 PostGIS 与索引

- 启用 Supabase 支持的 PostGIS 扩展。
- `location` 建立 GiST 索引。
- 为 `release_id + city + price_monthly`、`bedrooms`、`rent_type` 建立组合或辅助索引。
- 附近查询使用 `ST_DWithin`，距离排序使用 `ST_Distance`；坐标明确为 WGS84。

### 6.2 `search_historical_houses` RPC

允许的参数：城市、价格区间、租赁类型、卧室数、可选中心坐标、半径、排序、分页和返回数量。约束：

- `limit` 为 1–24；Agent 仍限制为 1–10。
- 半径为 100–5,000 米。
- 排序只允许 `distance | price_asc | price_desc | area_desc`。
- 只返回白名单字段和可选 `distance_m`。
- 只查询 `active` 数据版本。
- SQL 函数固定 `search_path`，参数在数据库层再次校验。

### 6.3 RLS 与调用边界

- 两张表均启用 RLS。
- `anon`、`authenticated` 不获得表级 `SELECT`。
- 房源 RPC 只授权给 `service_role`。
- 浏览器调用 `/api/houses` 或 `/api/chat`；Vercel 服务端再使用 `SUPABASE_SECRET_KEY` 调用 RPC。
- Next.js API 保留 Zod、请求 ID、限流、稳定错误和来源封装。

这意味着产品可供游客公开使用，但不等于把数据库整表暴露给浏览器。

## 7. 导入流程

导入器位于仓库脚本目录，但原始数据库、导出文件和密钥均不提交 Git：

1. 以 SQLite `mode=ro` 打开数据源。
2. 只读取白名单字段，并校验数值范围、文本长度和 URL 协议。
3. 丢弃价格非正数或坐标非法的行；其他缺失字段保存为 `null`。
4. 确定性解析卧室数，无法确认时保存为 `null`。
5. 生成 UUIDv5、来源键摘要和整个规范化数据集校验和。
6. 在 Supabase 创建 `importing` release，按固定批次幂等 upsert。
7. 比较源行数、清洗行数、远端行数、重复数和校验和。
8. 检查数据库容量；最终容量必须低于 400MB，保留至少约 20% 免费额度余量。
9. 通过服务端事务激活新版本；失败版本保持不可查询并记录失败原因。

Supabase Dashboard 的 CSV 上传不作为正式导入方法。

## 8. 应用行为

### 8.1 房源列表

- Live 模式读取 Supabase 历史房源。
- 页面统一显示“2024年11月历史房源”，不得显示“当前可租”。
- 缺失区县、地址、面积等字段显示“暂无记录”。
- 无真实图片时使用项目统一的历史数据占位图，不把占位图描述为房源实拍。

### 8.2 小智 `search_houses`

- 价格、户型、租赁类型和距离来自工具结果。
- 地名先由地图服务解析；进入 PostGIS 的中心坐标必须转换为与数据一致的 WGS84。
- 工具只回答数据实际包含的字段；用户追问缺失字段时简洁说明“历史数据未提供”。
- 当高德不可用且没有可信中心坐标时，不进行附近查询，也不猜测距离。

### 8.3 数据来源

成功结果固定包含：

```json
{
  "source": "housing_history_2024",
  "sourceLabel": "2024年11月杭州租房历史快照",
  "datasetPeriod": "2024-11",
  "isHistorical": true,
  "isRealtime": false,
  "disclaimer": "仅供历史房源参考，不代表当前仍可出租或当前价格"
}
```

## 9. 错误与降级

稳定错误或警告包括：

- `HOUSING_QUERY_INVALID`
- `HOUSING_DATASET_UNAVAILABLE`
- `HOUSING_LOCATION_UNAVAILABLE`
- `HOUSING_QUERY_FAILED`

规则：

- 参数错误不查询数据库。
- 活动数据版本不存在时，Live 模式明确不可用，不偷偷冒充真实数据。
- Supabase 暂时失败时可以显式回退 Demo，但来源必须改为 `supabase_mock / demo_fallback`，两种数据不得混合。
- 用户主动询问数据中不存在的字段时如实说明，不创建字段专用的特殊业务分支。

## 10. 测试与验收

### 数据与迁移

- 本地 Supabase reset 成功，或在隔离远端环境验证迁移。
- 两张表 RLS 已启用，匿名和登录用户均不能直接读取。
- 非活动 release 的数据无法通过 RPC 返回。
- 导入重复执行不增加记录；激活过程不会暴露部分批次。
- 远端行数、清洗统计和校验和与导入报告一致。
- 数据库最终容量低于 400MB。
- 表结构和 API 不包含 `raw`、联系方式、图片集合、内部自增 ID。

### 查询契约

- 价格、卧室数、租赁类型、半径和四种排序正确。
- PostGIS 距离与独立 Haversine 样本误差处于允许范围。
- 结果最多返回约定数量，未知参数和越界参数失败。
- Live 查询契约只覆盖历史数据中可验证的筛选条件。
- 空值保持为空，应用显示“暂无记录”。

### 应用与端到端

- `/api/houses` 和 `search_houses` 使用同一 Supabase 数据版本。
- 游客可使用页面和小智，但不能直接读取数据库表。
- 页面、小智卡片和最终文本均显示历史来源及免责声明。
- Supabase 故障时显示真实降级状态。
- 远端固定查询和关键 Agent 流程通过。
- 完整执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`；涉及页面和聊天时执行 `pnpm test:e2e`。

## 11. 实施顺序

1. 更新 PRD、工具契约和主演示用例，使其只包含 Live 数据可验证的筛选条件；新增迁移、RLS、RPC 和数据库契约测试。
2. 新增只读清洗/导入器及本地数据审计测试。
3. 新增 `HistoricalHousingSupabaseAdapter`，先以 fixture 测试响应与错误。
4. 切换房源列表和 `search_houses`，保留明确 Demo fallback。
5. 本地 Supabase 验证、容量预估和安全字段检查。
6. 分批导入远端但不激活，完成行数、校验和、容量和查询验收。
7. 激活 `2024-11` release，执行线上 API、RLS 和 E2E 冒烟。
8. 更新 PRD、架构、验收标准、部署文档和面试讲解；把 FastAPI 标记为已退役的本地原型。

## 12. 用户需要参与的节点

当前无需用户操作。只有遇到以下情况时才请求用户配合，并提供逐步指导：

- Supabase 免费容量预计或实际超过 400MB，需要决定升级或进一步裁剪字段。
- Supabase 控制台要求重新认证、确认项目或执行受保护操作。
- 远端导入前发现授权范围与拟公开字段不一致。
- 高德 Key 尚未配置，导致地名到坐标的 Live 验收无法完成。
