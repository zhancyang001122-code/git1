# 页面地图与状态

```text
/                                  首页
├── /houses                        房源列表
│   └── /houses/[id]               房源详情
├── /deals                         团购列表
│   └── /deals/[id]                团购详情
├── /market                        超市与商品
│   ├── /market/stores/[id]        商家详情
│   └── /market/products/[id]      商品详情
├── /cart                          购物车与演示结算
├── /nearby                        周边 POI
├── /discover                      推荐
│   └── /discover/[id]             社区内容详情
├── /xiaozhi                       小智欢迎页
│   ├── /xiaozhi/chat              新 AI 对话
│   ├── /xiaozhi/chat/[id]         已有对话
│   └── /xiaozhi/history           对话历史
├── /messages                      消息
├── /me                            我的
│   ├── /me/favorites              收藏
│   ├── /me/history                浏览与对话历史
│   ├── /me/orders                 演示订单
│   ├── /me/addresses              地址
│   ├── /me/preferences            小智偏好
│   └── /me/feedback               知识纠错与反馈
└── /knowledge-admin               知识运营队列
    └── /knowledge-admin/[id]       候选详情与审核
```

## 跨页面入口

- 首页搜索：跳到 `/xiaozhi/chat?q=<query>` 并自动发送。
- 任意业务卡片“问小智”：携带 `context.sourceType` 和 `context.sourceId`。
- 推荐内容“问问小智”：生成与帖子相关的默认问题，可编辑后发送。
- 房源详情“查看周边”：跳到周边页，并把房源坐标作为中心。
- 知识回答“纠错”：进入 `/me/feedback` 并携带 message/citation。
- 消息卡片：根据 `target_type` 跳到房源、团购、对话或知识审核。

## 每页必备状态

- Loading：骨架屏，不使用全屏转圈。
- Empty：解释为什么为空并给下一步。
- Error：稳定中文错误、重试按钮、request id。
- Offline/外部服务失败：保留已加载的本地或 Supabase 内容。
- Demo：Mock 业务对象显示“演示数据”标签。
