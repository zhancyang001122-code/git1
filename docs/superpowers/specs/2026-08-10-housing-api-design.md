# 房源查询 API 服务设计

## 1. 背景与目标

现有 `nearby-housing` 技能已经实现 Python、SQLite、R-Tree 和 FastAPI 查询原型，并使用 2024 年 11 月杭州租房历史快照完成过本机 HTTP 验证。本设计将这项能力整理为独立、可测试、可部署、可被未来小智调用的房源查询服务。

本阶段的交付目标是“本地接入就绪”，不是“公网生产就绪”。完成后，房源服务可以独立启动并通过稳定 HTTP 契约查询；尚未开始的小智框架保持不变，未来只通过 Adapter 接入。

## 2. 已确认的边界

### 2.1 本阶段包含

- 在 `services/housing-api` 建立独立 FastAPI 服务。
- 复用现有 SQLite、R-Tree 和附近房源查询能力。
- 提供版本化、经过校验的房源搜索 API。
- 提供鉴权、统一错误、来源标识、安全日志和基础限流。
- 使用自动化测试和真实数据库端到端测试证明服务可用。
- 提供本地启动、配置和调用文档。

### 2.2 本阶段不包含

- 不创建或修改小智的 Next.js 应用框架。
- 不修改 `xiaozhi-local-life-codex-kit`。
- 不直接修改 `.workbuddy/skills/nearby-housing` 作为最终项目代码。
- 不把完整 117MB SQLite 数据库提交到 GitHub。
- 不把 2024 年 11 月快照描述为实时房源或当前可租房源。
- 不在本阶段选择公网托管商或承诺公网生产就绪。
- 不迁移到 Supabase/Postgres/PostGIS；该项可作为后续架构升级。

## 3. 总体架构

```text
现有 WorkBuddy 房源技能与数据库
            │ 作为实现和数据来源
            ▼
services/housing-api
  FastAPI + Pydantic + SQLite read-only + R-Tree
            │ 稳定 HTTP 契约
            ▼
未来 HouseSearchAdapter
            │ 工具调用
            ▼
未来小智 Next.js / Agent
```

本地开发时，房源 API 读取现有数据库路径。未来上线时，FastAPI 部署为独立 Python 服务，小智通过环境变量切换服务地址，不改业务逻辑。

## 4. 服务组件

建议的服务内部边界如下：

```text
services/housing-api/
├── app/
│   ├── main.py             # FastAPI 应用与路由装配
│   ├── config.py           # 环境变量配置
│   ├── auth.py             # Bearer API Key 校验
│   ├── errors.py           # 统一错误模型与异常映射
│   ├── models.py           # Pydantic 请求/响应模型
│   ├── service.py          # 查询用例与安全字段映射
│   ├── repository.py       # SQLite 只读查询边界
│   └── observability.py    # request_id、耗时与安全日志
├── tests/
├── sample-data/
├── .env.example
├── requirements.txt
└── README.md
```

每个模块只承担一类职责，未来可以更换数据库或调用方，而无需重写全部服务。

## 5. HTTP 契约

### 5.1 接口

- `POST /v1/houses/search`：结构化查询附近历史房源。
- `GET /health`：检查服务和数据库是否可查询。

原型中的 `GET /nearby` 不作为新服务的正式契约。

### 5.2 鉴权

`POST /v1/houses/search` 必须携带：

```http
Authorization: Bearer <HOUSING_API_KEY>
```

API Key 仅存在于服务端环境变量中，不写入源码、不提交 Git、不返回浏览器。`/health` 只返回最少状态信息，不暴露数据库路径或内部异常。

### 5.3 请求

```json
{
  "city": "杭州",
  "center": {
    "lat": 30.2741,
    "lng": 120.1551,
    "coordinate_system": "WGS84",
    "label": "武林广场"
  },
  "radius_m": 2000,
  "filters": {
    "price_min": null,
    "price_max": 4000,
    "rent_type": "整租",
    "layout": null,
    "area_min": null,
    "area_max": null,
    "district": null
  },
  "sort": "distance",
  "limit": 5
}
```

约束：

- 第一版只支持杭州；其他城市返回 `UNSUPPORTED_CITY`。
- 经纬度必须在合法范围内，坐标系必须为 `WGS84`。
- `radius_m` 范围为 100 至 5000，默认 2000。
- `limit` 范围为 1 至 10，默认 5。
- 价格和面积不得为负数，下限不得高于上限。
- `rent_type` 仅支持服务明确声明的值。
- `sort` 仅支持 `distance`、`price_asc`、`price_desc`、`area_desc`。
- 地名解析和 GCJ-02/WGS84 坐标转换不属于本服务；未来由小智的地图 Adapter 在调用前完成。
- 数据缺少可靠宠物政策字段，因此第一版不接受宠物筛选，也不得假装完成该筛选。

### 5.4 成功响应

```json
{
  "ok": true,
  "data": {
    "returned_count": 1,
    "items": [
      {
        "listing_id": "house_xxx",
        "title": "整租·某小区两室一厅",
        "community": "某小区",
        "address": "杭州市拱墅区……",
        "district": "拱墅区",
        "distance_m": 860.3,
        "monthly_rent": 3800,
        "rent_type": "整租",
        "layout": "2室1厅",
        "area_sqm": 65,
        "orientation": "南",
        "floor": "中楼层",
        "source_url": "https://example.invalid/listing"
      }
    ]
  },
  "source": {
    "label": "2024年11月杭州租房历史快照",
    "dataset_period": "2024-11",
    "is_historical": true,
    "is_realtime": false,
    "disclaimer": "仅供历史房源参考，不代表当前仍可出租或当前价格"
  },
  "meta": {
    "request_id": "req_xxx",
    "duration_ms": 42,
    "warnings": []
  }
}
```

响应不得包含数据库内部自增 ID、`raw`、联系方式、完整图片集合、API Key 或不必要的采集字段。`returned_count` 仅表示本次实际返回数量，不冒充数据库总匹配数。

### 5.5 错误响应

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "price_min 不能大于 price_max",
    "retryable": false
  },
  "meta": {
    "request_id": "req_xxx"
  }
}
```

第一版错误码：

- `INVALID_ARGUMENT`
- `UNSUPPORTED_CITY`
- `UNAUTHORIZED`
- `RATE_LIMITED`
- `DATA_UNAVAILABLE`
- `INTERNAL_ERROR`

客户端只依赖稳定错误码，不依赖 Python 异常文本。响应不暴露堆栈、数据库路径或内部实现。

## 6. 数据库与数据管理

### 6.1 读写分离

现有原型在查询时调用数据库初始化逻辑，会执行 `CREATE TABLE IF NOT EXISTS`、触发器创建和提交。新服务必须把导入/迁移与在线查询分开：

- 数据导入或数据库重建是独立命令，允许写入。
- HTTP 查询使用 SQLite read-only 连接。
- 启动时检查文件、必要表和 R-Tree 索引是否可用。
- 查询测试前后可用文件校验值证明数据库未被修改。

### 6.2 配置

本地配置示例：

```env
HOUSING_DB_PATH=C:\Users\Administrator\WorkBuddy\房源\.workbuddy\skills\nearby-housing\scripts\nearby_housing.db
HOUSING_API_KEY=replace-with-a-random-local-secret
HOUSING_ENV=development
```

真实 `.env` 不提交 Git；仓库只提交 `.env.example`。

### 6.3 Git 与公开数据

- `.gitignore` 排除 `.env`、`*.db`、缓存、日志和测试临时文件。
- GitHub 只包含代码、测试、文档、导入工具和少量合法样例数据。
- 购买数据不自动等于拥有公开再分发权。在授权未确认前，公网演示使用模拟或明确获准的数据。
- 不提供完整数据库下载或批量遍历能力。

## 7. 安全与隐私

- 数据接口使用 Bearer API Key。
- 限制搜索半径、返回数量和基础请求频率。
- 浏览器不直接调用房源服务；未来由小智服务端调用。
- 日志可记录 `request_id`、耗时、状态和返回数量。
- 日志不得记录 API Key、用户身份、完整精确坐标、完整原始查询或数据库 `raw` 字段。
- 如需定位排错，仅记录模糊化位置或行政区。
- 所有异常经过统一映射，不向客户端返回内部堆栈。

## 8. 未来小智接入边界

未来数据流为：

```text
用户自然语言
  → 小智识别房源查询意图
  → 地名通过地图服务解析为坐标
  → 必要时将 GCJ-02 转为 WGS84
  → Zod 校验 search_houses 工具参数
  → HouseSearchAdapter 映射为房源 API 请求
  → FastAPI 使用 Pydantic 再次校验
  → SQLite/R-Tree 查询
  → Adapter 将稳定响应交给 Agent
  → Agent 明确说明结果为 2024-11 历史快照
```

Pydantic 保护 Python 服务边界，Zod 保护 TypeScript/Agent 边界。两层校验独立存在，避免任一调用方绕过校验后破坏下游。

未来小智工具契约中的 `pets_allowed` 暂无可靠数据支持。Adapter 应返回明确的能力不足提示，不得将未筛选结果描述为满足宠物条件。

## 9. 测试策略

### 9.1 单元测试

- 坐标、城市、半径、数量、价格和面积校验。
- 价格/面积上下限关系。
- 排序枚举和租赁类型枚举。
- 数据库记录到安全 API 字段的映射。
- 内部字段删除。
- 历史来源元信息。
- 异常到稳定错误码的映射。

### 9.2 API 集成测试

- `/health` 真实反映数据库可用性。
- 合法与非法 API Key。
- 正常结果、空结果和错误结果的 HTTP 状态码与 JSON 契约。
- 请求上限与基础限流。
- OpenAPI 对请求和响应模型的描述。
- 错误响应不包含内部异常或路径。

### 9.3 本地端到端测试

使用 2024 年 11 月真实数据库执行固定位置查询，验证：

- 武林广场等代表性位置能够返回附近记录。
- 距离升序、半径过滤和价格/面积/整租筛选正确。
- 每个响应都有历史数据标识。
- 响应不包含 `raw`、联系方式或内部 ID。
- 查询前后数据库文件校验值相同。
- 预热后执行 20 次代表性请求，P95 小于 1 秒。

## 10. 验收标准

全部满足后，状态标记为“本地接入就绪”：

1. 一条文档化命令可以启动服务。
2. `/health` 返回服务与数据库真实状态。
3. `/v1/houses/search` 与本设计契约一致。
4. API Key、参数校验、限流和统一错误生效。
5. SQLite 查询全程只读。
6. 单元测试、API 集成测试和真实数据端到端测试全部通过。
7. `.env.example` 完整且不含真实密钥。
8. README 足以让新的开发者完成配置、启动和请求。
9. Git 中不包含完整数据库、真实密钥或隐私字段。
10. WorkBuddy 原技能、小智设计套件和小智框架没有被修改。
11. 提交信息遵循仓库的 Conventional Commits 规范。

“公网生产就绪”是后续里程碑，还需要选定托管环境、确认数据公开许可、配置 HTTPS 和线上密钥、执行线上健康检查和跨服务调用测试。

## 11. 提交策略

设计与实现使用小步、可审查的 Conventional Commits，例如：

- `docs(housing): define housing API service design`
- `test(housing): define validated API contract`
- `feat(housing): add read-only listing repository`
- `feat(housing): add authenticated search endpoint`
- `test(housing): cover real database acceptance cases`
- `docs(housing): document local service operation`

普通提交不创建 Git tag；tag 仅用于可发布版本。

