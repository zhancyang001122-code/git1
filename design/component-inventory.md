# 组件清单

## 布局组件

| 组件 | 职责 | 关键约束 |
|---|---|---|
| `MobileCanvas` | 430px 居中画布 | 360–430px 无横向滚动 |
| `AppShell` | 主页面外壳 | 统一底部留白和背景 |
| `PageHeader` | 返回、标题、操作 | 56px，高度固定 |
| `BottomNavigation` | 五个主导航 | 只实现一次，中央小智突出 |
| `SafeAreaSpacer` | iOS 安全区 | 使用 `env(safe-area-inset-bottom)` |

## 通用组件

`LocationSelector`、`SearchBar`、`SectionHeader`、`CategoryGrid`、`FilterBar`、`FilterSheet`、`Tag`、`SourceBadge`、`Price`、`Avatar`、`EmptyState`、`ErrorState`、`SkeletonCard`、`DemoNotice`、`Toast`。

## 业务组件

- `HouseCard`：价格、户型、面积、宠物、地铁、收藏、问小智。
- `DealCard`：商家、原价、折扣价、销量、有效期、退款标签。
- `StoreCard`：商家、配送时间、起送、商品横滑。
- `ProductCard`：价格、库存、加购、详情。
- `CommunityPostCard`：封面、作者、位置、互动、问小智。
- `MessageCard`：类型、摘要、时间、未读、目标链接。
- `PreferenceEditor`：显示来源、授权开关和撤销入口。

## AI 组件

| 组件 | 输入 | 输出/交互 |
|---|---|---|
| `ChatComposer` | 文本、附件上下文、定位 | 发送、停止、重试 |
| `ChatBubble` | role、markdown、状态 | 文本、复制、反馈 |
| `QuickPrompt` | label、prompt | 一键发送 |
| `ToolProgress` | progress events | 可理解的执行步骤 |
| `ToolDebugPanel` | debug events | 工具、参数摘要、耗时、来源 |
| `ResultCards` | discriminated union | 房源/团购/商品/POI卡片 |
| `KnowledgeSources` | citations | 标题、版本、生效日期、摘录 |
| `LowConfidenceBanner` | reason | 转人工/纠错/改写问题 |
| `FollowUpSuggestions` | prompts | 继续缩小需求 |

## 组件化禁令

- 不允许在每个页面复制底部导航。
- 不允许为相同卡片状态创建三套不同 CSS。
- 不允许直接把数据库行对象传遍 UI；先映射到 domain contract。
- 不允许组件自行调用千问、高德或 service-role Supabase。
- 页面文件超过约 250 行时，按清晰职责拆分，不做无关重构。
