# UI 设计系统

## 1. 设计方向

采用“微信小程序结构 × 小智品牌”的移动端 Web 设计：

- 使用小程序常见的导航栏、功能胶囊、Cell、底部弹层、Toast、确认弹窗和扁平 TabBar。
- 保留小智蓝紫色品牌，不把微信绿当作主品牌色。
- 不显示微信商标，不声称这是可提交审核的原生微信小程序。
- Web 中出现的胶囊、返回、定位、收藏和关闭按钮必须具备真实行为，不能只做装饰。
- 移动设备不模拟假的系统状态栏，避免与浏览器或系统状态栏重复。

## 2. 布局 Token

| Token | 值 |
|---|---:|
| 画布最大宽度 | 430px |
| 页面水平边距 | 16px |
| 顶部导航 | 48px + `env(safe-area-inset-top)` |
| 右侧功能胶囊 | 84 × 32px |
| 搜索框 | 40px |
| 底部导航 | 56px + `env(safe-area-inset-bottom)` |
| 区块间距 | 16px |
| 卡片间距 | 10px |
| 卡片内边距 | 12–16px |
| 最小交互目标 | 44 × 44px |

桌面外部背景为 `#EDEFF2`，移动画布为 `#F5F5F5`。主内容底部至少留 `calc(72px + env(safe-area-inset-bottom))`。

## 3. 色彩 Token

| Token | 值 | 用途 |
|---|---|---|
| brand-500 | `#4169F5` | 主要按钮、选中态、小智能力 |
| brand-600 | `#3155E8` | 按压态 |
| violet-500 | `#7557F6` | AI 辅助渐变和强调 |
| page | `#F5F5F5` | 小程序式页面背景 |
| surface | `#FFFFFF` | 导航、Cell、卡片、弹层 |
| text-primary | `#111111` | 主文字 |
| text-secondary | `#57606A` | 辅助说明 |
| text-muted | `#8C8C8C` | 占位和弱信息 |
| border | `#E5E5E5` | 细分割线 |
| success | `#07C160` | 成功与授权完成，不作为品牌主色 |
| warning | `#FA9D3B` | 风险提示 |
| danger | `#FA5151` | 错误和危险操作 |

AI 大卡可以使用克制的 `linear-gradient(135deg, #EEF2FF, #F3EDFF)`。普通业务区域不使用大面积渐变或发光。

## 4. 字体层级

| 层级 | 字号/行高 | 字重 |
|---|---|---|
| Display | 28/38 | 700 |
| Page title | 18/26 | 600 |
| Section title | 18/26 | 600 |
| Card title | 16/24 | 600 |
| Body | 14/22 | 400 |
| Secondary | 13/20 | 400 |
| Label | 12/18 | 500 |

字体：

```css
-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif
```

## 5. 圆角、分割线和阴影

- 原生列表 Cell：单独出现时 12px；连续分组内部不重复圆角。
- 普通卡片：12px。
- 大模块和底部弹层：16px。
- 搜索、标签和按钮：8–12px，胶囊标签可使用 999px。
- 分割线：`1px solid #E5E5E5`，左右跟随内容缩进。
- 普通卡片默认无阴影或仅 `0 2px 8px rgba(0,0,0,.04)`。
- 只有底部弹层和悬浮反馈使用较明显阴影。

## 6. App Shell

### MiniProgramNavigationBar

- 高度 48px，标题居中，字号 18px。
- 二级页显示返回按钮；首页不显示无效返回按钮。
- 右侧 84 × 32px 功能胶囊包含“更多”和“返回首页”两个真实按钮。
- 胶囊使用半透明白底、灰色描边和 44px 触控区。

### BottomNavigation

- 五栏等分：首页、推荐、小智、消息、我的。
- 图标 22px，文字 12px，总高度 56px + safe area。
- 默认深灰，当前页使用 `brand-500`。
- 小智不再上浮，通过选中态、首页 AI 卡和固定对话入口体现核心地位。
- 背景为高不透明白色，顶部使用 1px 分割线，不使用大面积光晕。

## 7. 小程序式交互组件

### CellGroup

用于设置、偏好、订单和地址。主标题、辅助文字、状态和右箭头保持固定对齐；危险操作单独分组。

### ActionSheet

用于筛选、排序、定位方式和分享。移动端从底部出现，支持遮罩关闭、Esc 和焦点回收。

### Toast

用于收藏、加入购物车、保存偏好等可恢复操作，1.5–2 秒后自动消失，并通过 `aria-live` 播报。

### ConfirmDialog

用于删除、清空、覆盖偏好和离开未保存内容。确认按钮明确描述动作，不使用含糊的“确定”。

### Loading / Empty / Error

- 首屏和列表使用骨架屏。
- 无结果解释当前条件，并提供放宽筛选或重新查询。
- 定位拒绝提供“使用武林广场演示位置”。
- 外部服务失败保留已经成功的数据，提供局部重试。

## 8. AI 组件

### ChatMessage

- 用户消息使用品牌蓝浅色或深色气泡，靠右。
- 小智文本使用白色气泡或白色内容卡，靠左。
- 结构化结果、知识引用和工具进度不塞进纯文本气泡。

### ToolProgress

只显示公开处理步骤：理解需求、查询房源、检查周边、检索规则、生成结果。不显示模型思维链。

### KnowledgeCitation

显示来源标题、版本、生效日期和引用片段；点击展开底部弹层。低置信或冲突使用警示卡，不伪装成确定回答。

### AgentDebugPanel

仅 `NEXT_PUBLIC_ENABLE_AI_DEBUG=true` 时显示：

- toolName
- 参数摘要
- source
- durationMs
- resultCount
- errorCode

禁止显示密钥、系统 Prompt、完整敏感文本。

## 9. 响应式和可访问性

- 360–430px 满宽；大于 430px 时居中。
- 390px 以下双列结果在信息过密时改为单列。
- 交互目标至少 44 × 44px，图标按钮必须有 `aria-label`。
- 支持 `focus-visible`、Esc 关闭弹层、焦点回收和键盘操作。
- 动画尊重 `prefers-reduced-motion`。
- 所有输入有可访问名称，状态变化通过 `aria-live` 表达。

详细 Token 实现统一位于 `web/src/app/globals.css` 和基础组件层，业务页面不得散落重复颜色或尺寸。
