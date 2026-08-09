# 需求追踪矩阵

本表防止“分阶段”被误解为删除需求。每项最终需求都映射到实现 Task 和验收。

| 需求 | 主要规格 | 实施 Task | 验收证据 |
|---|---|---:|---|
| 430px 统一设计系统 | 03、04、design/ | 2 | 360/390/430 E2E、组件测试 |
| 首页、推荐、小智、消息、我的 | 01、02、04 | 3 | 全路由 E2E |
| 房源、团购、超市、周边与详情 | 01、04 | 3、4、7 | 页面 E2E、repository tests |
| 收藏、购物车、演示订单、地址 | 01、02、04 | 3、4 | 交互测试、RLS tests |
| Supabase 结构化业务数据 | 07、migrations | 4 | migration、mapper、数据一致性 |
| 千问流式多轮对话 | 05、contracts | 5 | SSE/API integration |
| Function Calling 和严格工具 | 05、contracts | 6 | schema、loop、routing eval |
| 高德 POI、地理编码、步行路线 | 05、04、14 | 7 | fixture、降级 E2E |
| 深入 RAG：版本、混合检索、重排、引用 | 06、migrations | 8 | retrieval/eval/citation tests |
| 多工具组合查询 | 05、qa | 9 | 主演示 E2E |
| 多轮摘要和授权偏好 | 05、07 | 9 | memory precedence tests |
| 反馈、知识候选、人工审核和发布 | 06、09 | 10 | knowledge-loop E2E |
| 发布后 embedding 和回归评测 | 06、09、qa | 10 | index/eval run records |
| RLS、密钥、日志脱敏、限流和超时 | 08、13、14 | 4、11 | security/degradation tests |
| Vercel 部署、二维码和录屏备份 | 09、14 | 12 | production smoke evidence |
| 企业级拆分与治理路线 | 09 | 设计交付 | 面试问答与 roadmap review |

编号规格均位于 `docs/`，实施 Task 位于 `docs/superpowers/plans/2026-08-05-xiaozhi-implementation.md`。
