# Phase 2：统一设计系统和应用壳

执行实施计划 Task 2。读取：

- `config/design-tokens.json`
- `config/tailwind-theme.css`
- `docs/03-ui-design-system.md`
- `design/component-inventory.md`

实现：

- 430px `MobileCanvas`
- `AppShell`、`PageHeader`、`BottomNavigation`
- 五个主导航：首页、推荐、小智、消息、我的
- 64px 中央小智按钮，底部安全区
- 基础 Button、IconButton、Tag、SourceBadge、SearchBar、SectionHeader
- Loading、Empty、Error、DemoNotice
- Story-like `/dev/components` 页面，仅开发模式可访问

复制原型图到 `web/public/prototypes/` 仅作为开发参考，不在产品页面直接展示。

必须测试：活动导航、最小点击面积、BottomNavigation 单实例、360px 无横向滚动、键盘焦点可见。
