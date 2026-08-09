# Phase 9：测试、可观测性与部署

执行实施计划 Task 11 和 Task 12，每次只做一个 Task。

质量门禁：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Playwright 必测：

1. 首页搜索进入小智。
2. 3500 元内可养猫一居室返回正确卡片。
3. 团购退款回答显示知识引用。
4. 多工具房源 + 周边流程显示进度和降级。
5. 点踩生成知识候选。
6. 360、390、430px 无横向滚动。

可观测性：request id、模型耗时、每个工具耗时、检索分数、引用、错误码；日志脱敏。

Vercel：Root Directory 为 `web/`，环境变量按 preview/production 分开。部署后运行 smoke test；README 记录演示二维码生成方法和服务降级开关。
