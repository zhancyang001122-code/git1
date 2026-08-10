# Phase 3 完整前端实施计划

## Task 1：领域模型和确定性 Demo Repository

- 创建业务领域类型、分页和筛选类型。
- 创建 12 房源、8 团购、16 商品、3 门店、10 社区内容。
- 先测试房源多条件筛选、商品库存筛选、稳定排序和按 ID 查询。
- 提交：`feat(data): add deterministic demo business repository`

## Task 2：业务卡片和共享详情外壳

- 创建 `DetailShell`、`HouseCard`、`DealCard`、`ProductCard`、`StoreCard`、`CommunityPostCard`。
- 所有卡片接收领域对象和回调，不读取环境变量或调用 API。
- 测试 Demo/历史来源标识和关键字段。
- 提交：`feat(ui): add reusable business presentation components`

## Task 3：推荐、小智、消息和我的主页面

- 完成 `/discover`、`/xiaozhi`、`/messages`、`/me`。
- 每页复用唯一 `BottomNavigation`。
- 增加筛选、快捷问题、消息标签和入口导航。
- 提交：`feat(pages): add primary product destinations`

## Task 4：房源和团购路由

- 完成列表与动态详情路由。
- 房源使用 2024 历史标识；团购使用演示业务标识。
- 增加本地筛选、排序、收藏、问小智和演示购买提示。
- 提交：`feat(business): add housing and deal experiences`

## Task 5：超市、商品、购物车和周边路由

- 完成 `/market`、门店详情、商品详情、`/cart`、`/nearby`。
- 库存、价格和配送只描述为演示数据。
- 周边使用固定演示中心，不伪造精确距离和路线。
- 提交：`feat(business): add market cart and nearby experiences`

## Task 6：社区详情、小智对话和上下文协议

- 创建 Zod 白名单上下文编解码。
- 完成社区详情、聊天新会话、已有会话和历史页面。
- 本地脚本化对话明确标注未接入真实模型。
- 提交：`feat(ai-ui): add validated demo conversation flows`

## Task 7：用户中心和知识运营路由

- 完成收藏、历史、演示订单、地址、偏好、反馈。
- 完成知识候选列表和审核详情演示。
- 写操作均显示仅本地演示，不声称已持久化或发布。
- 提交：`feat(account): add profile and knowledge demo flows`

## Task 8：完整路由和交互 E2E

- 遍历 `config/routes.json` 的 26 个路由和固定动态 ID。
- 验证主标题、导航数量、无横向滚动和关键交互。
- 运行全部质量门禁和密钥/范围审计。
- 为全部页面生成集中预览截图。
- 提交：`test(pages): verify complete clickable frontend`
