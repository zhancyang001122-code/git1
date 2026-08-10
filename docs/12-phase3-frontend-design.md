# Phase 3 完整前端设计

**日期：** 2026-08-10  
**状态：** 执行中  
**目标：** 在不接入外部服务的前提下，完成 `config/routes.json` 中全部 26 个路由及可演示交互，为后续 Supabase、Qwen、AMap 和 RAG 提供稳定 UI 与领域边界。

## 1. 交付范围

### 包含

- 五个主页面：首页、推荐、小智、消息、我的。
- 社区详情、小智对话与历史。
- 房源、团购、超市、商品、购物车、周边服务。
- 收藏、历史、演示订单、地址、偏好、知识反馈。
- 知识运营列表和候选审核演示。
- 统一 Loading、Empty、Error、Demo 状态。
- 360、390、430px 响应式检查和全部路由 E2E。

### 不包含

- Supabase、Qwen、AMap、RAG 或任何外部网络请求。
- 真实支付、核销、签约、预约、配送和知识发布。
- 将演示数据描述成实时库存、实时房源、真实交易或真实 AI 结果。

## 2. 方案选择

采用“完整可点击前端 + 单一类型化 Demo Repository”。

没有采用以下两种方案：

1. 先做一条真实后端竖切：真实性高，但会导致其他页面长期缺失，不利于集中预览和作品集演示。
2. 直接把原型逐页硬编码：视觉快，但数据重复、交互不可维护，后续接真实服务需要重写。

当前方案先建立稳定领域类型、仓储接口和页面上下文协议。后续真实仓储实现只替换 adapter，不改变卡片和路由组件。

## 3. 架构

```text
route server component
  -> presentation mapper / application query
      -> BusinessRepository interface
          -> deterministic DemoBusinessRepository

small client islands
  -> URL context / local state
  -> visible demo notice
  -> no external request
```

### 领域层

`web/src/features/business/` 定义：

- `House`、`Deal`、`Store`、`Product`、`CommunityPost`。
- `Page<T>` 和筛选类型。
- `BusinessRepository` 接口。
- 固定 ID、稳定排序、明确 `isDemo: true` 的演示数据。

页面和卡片不接收数据库行对象。动态路由只通过 repository 按 ID 查询；不存在的 ID 使用 `notFound()`。

### 导航上下文

`xiaozhi-context.ts` 使用 Zod 编解码页面上下文。搜索、“问问小智”和业务卡片只传白名单字段，例如实体类型、实体 ID、用户问题，不传任意 JSON 或隐藏指令。

### 客户端状态

仅以下行为使用客户端组件：

- 筛选、排序和消息标签。
- 收藏与购物车演示数量。
- 搜索、快捷问题和聊天输入。
- 偏好、地址、反馈和知识审核表单。

刷新后不保证持久化；界面必须显示“演示流程”或“仅保存在当前页面”。

## 4. 页面结构

### 主页面

- `/discover`：分类、双列社区卡片、收藏和问小智。
- `/xiaozhi`：欢迎卡、快捷任务、推荐问题和演示模式说明。
- `/messages`：全部、系统、小智、互动四类消息。
- `/me`：用户概览、快捷统计、偏好摘要和功能入口。

### 业务页面

- `/houses`：筛选、排序、房源卡片；房源统一标注 `2024 历史房源示例`。
- `/deals`：分类、价格、退款标签和演示购买边界。
- `/market`：门店、商品、库存演示标识和购物车。
- `/nearby`：固定武林广场演示中心；不展示伪造距离或路线时间。

### 小智页面

- 对话页只运行本地脚本化演示，不声称已调用模型。
- 工具进度组件展示公开步骤，不显示思维链。
- 示例卡片来自同一 Demo Repository，确保页面与聊天字段一致。

### 用户和运营页面

- 订单统一标注“演示订单/模拟履约”。
- 偏好写入必须显示仅当前页面有效。
- 反馈只生成待审核演示记录，不声称写入知识库。
- 知识发布按钮只更新本地展示状态，不声称已索引或上线。

## 5. 数据规模

- 12 条房源。
- 8 条团购。
- 16 条商品，至少 3 个门店。
- 10 条社区内容。
- 固定消息、订单、地址、偏好、对话和知识候选记录。

演示记录使用稳定 ID，便于动态路由、测试和后续 SQL seed 对齐。

## 6. 测试与验收

- Repository 测试精确筛选、稳定排序和缺失 ID。
- 组件测试来源标识、上下文编码、收藏/购物车和表单边界。
- E2E 访问全部 26 个路由，确认无 404、主标题存在。
- E2E 验证问小智上下文、消息筛选、购物车和演示订单提示。
- 360/390/430px 无横向滚动，五个主页面共用唯一底部导航。
- 最终运行 `format:check`、`lint`、`typecheck`、`test`、`build`、`test:e2e`。

## 7. 后续替换点

Phase 4 用 `SupabaseBusinessRepository` 替换 Demo Repository；Phase 5 接入真实聊天流；Phase 7 接入 AMap；Phase 8 接入 Knowledge Service。UI 不直接感知供应商 SDK、SQL 或密钥。
