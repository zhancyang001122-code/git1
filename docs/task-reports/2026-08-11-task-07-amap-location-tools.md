# Task 7 验证报告：高德定位、周边搜索与步行路线

日期：2026-08-11

## 交付范围

- 新增独立 `MapsService` 端口以及高德、fixture、未配置三类 Adapter，不把外部 API 细节写进页面或 Agent。
- 新增服务端 `POST /api/maps/nearby`，浏览器不接触 `AMAP_WEB_SERVICE_KEY`。
- 接入地理编码、周边 POI、步行路线和 GPS → 高德坐标转换。
- 注册 `search_nearby_places`、`calculate_walking_route` 两个严格工具，工具总数从 7 个增加到 9 个。
- 小智在用户明确给出中心地点时支持“先查房源，再查周边”的连续工具调用；地图失败时保留房源卡，并明确说明周边尚未核验。
- `/nearby` 完成主动定位、默认地点、类别切换、地点卡和路线交互。

## 关键技术边界

### 密钥与坐标

- 高德 Web Service key 只从服务端环境读取，不进入 `NEXT_PUBLIC_*`、页面 props、客户端 bundle 或日志。
- 内部坐标统一使用 `{ longitude, latitude }`，只在高德 Adapter 边界序列化为 `longitude,latitude`。
- 浏览器 Geolocation 返回的 GPS 坐标先调用高德坐标转换接口，再用于 POI 查询和后续路线起点；避免直接混用坐标系造成位置偏移。
- 用户未主动点击“使用我的位置”前不请求定位权限；拒绝、超时或浏览器不支持时，界面明确提示并回退到杭州武林广场。

### 真实模式与演示模式

- `NEXT_PUBLIC_DEMO_MODE=true` 使用确定性 fixture，并同时展示“高德接口演示数据，未发起实时调用”和卡片级“接口演示数据”标签。
- 正式模式缺少 key 时返回 `AMAP_NOT_CONFIGURED`，不会暗中切换 fixture。
- 正式 Adapter 将鉴权、额度/频率、超时、畸形响应归一化为稳定错误：`AMAP_UNAUTHORIZED`、`AMAP_QUOTA`、`AMAP_TIMEOUT`、`AMAP_INVALID_RESPONSE`。
- 地理编码、POI 或路线无结果时返回 `AMAP_NO_RESULT`，不会补造地点、距离或分钟数。

## 工具编排与有界调用

- `search_nearby_places` 支持地点名称或完整经纬度；运行时 Zod 额外保证地点名称非空，或经纬度成对出现。
- 地点名称先地理编码，再进行周边搜索；地点卡只显示 Adapter 返回的 POI、距离和来源。
- `calculate_walking_route` 只接受两组有效坐标，距离和耗时完全来自 Maps Service。
- 多候选周边查询 helper 最多处理 5 个候选，并限制为最多 3 个并发请求，避免无界扇出。
- 房源 + 周边组合问题中，业务卡和地图卡分别保留来源；fixture 房源不代表当前可租。

## 用户界面

- 周边页初始状态为“选择定位方式”，明确说明只有主动点击才申请权限。
- 支持“使用我的位置”和“使用武林广场”，并可切换超市、餐饮、咖啡、医院四类查询。
- 地点卡展示分类、地址、距离、来源和演示状态；路线按钮展示步行米数与预计分钟。
- 小智对话展示“正在查询房源”“正在查询周边地点”两段公开进度，不暴露内部参数或密钥。

## 官方契约核对

- 周边搜索使用 `GET /v3/place/around`，中心点按经度在前、纬度在后传递。
- 地理编码使用 `GET /v3/geocode/geo`。
- 步行路线使用 `GET /v3/direction/walking`。
- 浏览器 GPS 坐标使用 `GET /v3/assistant/coordinate/convert` 且 `coordsys=gps` 转换。
- 高德返回 `infocode=10000` 视为成功；无效 key、权限、额度和频率错误在 Adapter 中统一映射。

参考：

- <https://lbs.amap.com/api/webservice/guide/api/search/>
- <https://lbs.amap.com/api/webservice/guide/api/georegeo/>
- <https://lbs.amap.com/api/webservice/guide/api/direction/>
- <https://lbs.amap.com/api/webservice/guide/api/convert>
- <https://lbs.amap.com/api/web-service/tools/info>

## 自动验证证据

- `pnpm lint`：通过，0 error、0 warning
- `pnpm typecheck`：通过
- `pnpm test`：51 个测试文件、196 项测试全部通过
- `pnpm build`：通过，新增动态路由 `/api/maps/nearby`
- `pnpm test:e2e` / `playwright test`：Chromium 40 项全部通过
- 页面预览：26 个路由模板完成 430px 长截图；周边页截图包含定位状态、演示来源、POI 和路线入口

测试覆盖包括：经纬度顺序、GPS 转换、地理编码、POI、路线、无效 key、额度、超时、畸形响应、严格参数、无结果、服务端 API 校验、定位拒绝回退、fixture 显式标签、地点卡、有界 fan-out、房源 → 地图连续工具调用、地图超时降级和移动端宽度。

## 尚未形成的证据

当前环境没有 `AMAP_WEB_SERVICE_KEY`，因此没有执行真实高德在线 smoke test，也不能宣称已验证真实额度、真实 POI 或真实步行路线。当前证据来自官方契约核对、fixture 契约测试、服务端边界测试和完整浏览器演示流程。

当前确定性演示 Provider 不会把含糊的“附近”擅自解释成武林广场：缺少中心地点时会要求补充地点或前往周边页主动授权定位。多房源的 5 个候选 / 3 并发 / 前 3 路线评估已经作为应用服务和测试基础完成，但“按每套房源分组展示并自动排序”的完整比较界面应留到综合工作流阶段，不能把本阶段的通用地点卡宣称为逐套房源排名。

获得 Web Service key 后，下一步只需在正式模式配置服务端环境变量并执行受控在线 smoke test；在此之前界面会始终诚实标注 fixture。Task 8 将进入 Knowledge Service 与 RAG 引用闭环。
