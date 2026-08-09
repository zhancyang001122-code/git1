# UI 设计系统

原型图只定义内容结构和视觉方向。实现统一 Token，不逐图猜尺寸。

## 1. 布局

| Token | 值 |
|---|---:|
| 画布最大宽度 | 430px |
| 页面水平边距 | 16px |
| 顶部栏 | 56px |
| 搜索框 | 48px |
| 底部导航 | 76px + safe area |
| 小智按钮 | 64px |
| 区块间距 | 20px |
| 卡片间距 | 12px |
| 卡片内边距 | 16px |

桌面外部背景 `#EAF0FA`，移动画布 `#F7F9FD`。主内容底部至少留 `calc(96px + env(safe-area-inset-bottom))`。

## 2. 色彩

| Token | 值 |
|---|---|
| brand-500 | `#4169F5` |
| brand-600 | `#3155E8` |
| violet-500 | `#7557F6` |
| cyan-400 | `#4FD8FF` |
| page | `#F7F9FD` |
| soft | `#F1F5FF` |
| surface | `#FFFFFF` |
| text-primary | `#161A25` |
| text-secondary | `#62697A` |
| text-muted | `#9AA1B2` |
| border | `#E7EBF4` |
| success | `#22B866` |
| warning | `#FF8A34` |
| danger | `#FF4D32` |

AI 大卡：`linear-gradient(135deg, #EEF2FF, #F3EDFF)`。

## 3. 字体层级

| 层级 | 字号/行高 | 字重 |
|---|---|---|
| Display | 28/38 | 700 |
| Page title | 24/32 | 700 |
| Section title | 18/26 | 600 |
| Card title | 16/24 | 600 |
| Body | 14/22 | 400 |
| Secondary | 13/20 | 400 |
| Label | 12/18 | 500 |

字体：
```css
-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif
```

## 4. 圆角与阴影

- 标签 8px
- 按钮 12px
- 普通卡片 16px
- 大模块 20px
- 胶囊 999px
- 卡片阴影 `0 8px 24px rgba(51,76,145,.08)`
- 浮层阴影 `0 12px 32px rgba(29,45,92,.14)`

## 5. 底部导航

唯一 `BottomNavigation`：

- 五等分：首页、推荐、小智、消息、我的
- 普通图标 24px，文字 12px
- 小智 64px，向上突出 14px
- 当前页蓝色；小智当前页增加光晕
- 未读数最大 `99+`
- 透明白背景 + backdrop blur

## 6. 状态

所有交互组件覆盖 default、hover、pressed、focus-visible、disabled、loading。  
异步区域覆盖 skeleton、empty、error、retry、stale。

## 7. AI 组件

### ToolProgress
只显示公开处理步骤：理解需求、查询房源、检查周边、检索规则、生成结果。不显示模型思维链。

### AgentDebugPanel
仅 `NEXT_PUBLIC_ENABLE_AI_DEBUG=true` 时显示：
- toolName
- 参数摘要
- source
- durationMs
- resultCount
- errorCode

禁止显示密钥、系统 Prompt、完整敏感文本。

## 8. 响应式和可访问性

- 360–430px 满宽；>430px 居中
- 390px 以下对话结果卡改为上下布局
- 交互目标至少 44×44
- 支持 focus-visible
- 动画尊重 `prefers-reduced-motion`
- 所有输入有 label/aria-label

详细 Token 见 `config/`。
