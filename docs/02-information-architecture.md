# 信息架构与用户流

## 页面树

```text
/
├── /discover
│   └── /discover/[id]
├── /xiaozhi
│   ├── /xiaozhi/chat
│   ├── /xiaozhi/chat/[conversationId]
│   └── /xiaozhi/history
├── /messages
├── /me
│   ├── /me/favorites
│   ├── /me/history
│   ├── /me/orders
│   ├── /me/addresses
│   ├── /me/preferences
│   └── /me/feedback
├── /houses
│   └── /houses/[id]
├── /deals
│   └── /deals/[id]
├── /market
│   ├── /market/stores/[id]
│   └── /market/products/[id]
├── /cart
├── /nearby
└── /knowledge-admin
    └── /knowledge-admin/[id]
```

## 关键跨页面流

### 首页搜索 → 小智

```text
首页输入自然语言
→ /xiaozhi/chat?q=<query>&source=home-search
→ 自动发送问题
→ 显示工具进度和结果
```

### 推荐卡片 → 小智

```text
问问小智
→ 传递 sourceType=community_post、sourceId 和 suggestedPrompt
→ 服务端加载并校验帖子上下文
→ 按需调用地图、业务或知识工具
```

### 房源卡片 → 小智

```text
问小智看周边
→ /xiaozhi/chat?sourceType=house&sourceId=<id>
→ get_house_detail
→ search_nearby_places
→ 必要时 calculate_walking_route
→ 结果卡片
```

### 知识闭环

```text
点踩/纠错/低置信
→ POST /api/feedback（验证消息归属）
→ knowledge_candidate
→ 人工审核
→ 发布不可变版本
→ embedding
→ 回归评测
```

## 状态边界

- URL：筛选、排序、地点、Tab、上下文 ID。
- Server state：业务数据、对话、知识来源、消息。
- Client state：输入、展开、购物车临时反馈、调试面板。
- 长期偏好：`user_preferences`，需要同意。
- 对话记忆：`conversation_messages` + `conversation_sessions.summary`。
