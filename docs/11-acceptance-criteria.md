# 验收标准

状态说明：`[x]` 只表示仓库代码或本地 Demo 已有验证证据；`[ ]` 表示必须依赖用户账号、真实材料或线上环境继续验证。不能用本地契约测试替代在线接通结论。

## P0 工程

- [x] `web/` 可安装启动
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] 核心 Playwright Demo 通过

## P0 视觉

- [x] 360/390/430px 无横向滚动
- [x] 五主页面统一导航
- [x] 顶部标题栏和右侧功能胶囊符合小程序式设计，按钮具有真实行为
- [x] 底部五栏扁平等分，小智按钮不上浮
- [x] 字号、圆角、边距符合 Token
- [x] 桌面 430px 居中
- [x] 不出现逐页尺寸漂移
- [x] ActionSheet、Toast、确认弹窗覆盖键盘和可访问性状态

## P0 页面

- [x] 首页、推荐、小智、消息、我的
- [x] 房源、团购、超市、周边和详情
- [x] 收藏、购物车、偏好、对话历史、知识反馈
- [x] Mock 和模拟交易标识

## P0 API 契约

- [x] 房源、团购、商品和社区内容只读列表 API
- [x] 严格查询参数、稳定错误、请求 ID 和来源封装
- [x] 反馈 API 验证消息归属，反馈不暴露为模型工具
- [ ] 用户偏好 GET/PATCH API 与授权时间更新

## P0 AI

- [x] 流式多轮协议、取消、超时和确定性 Demo Provider
- [ ] 使用用户百炼账号在线验证千问流式多轮和 Function Calling
- [x] `search_houses` 可查询本机 2024-11 只读历史房源；未配置时明确降级
- [ ] `search_houses` 查询用户远端 Supabase
- [x] `search_nearby_places` 的 Adapter、fixture 契约和缺 Key 降级
- [ ] 使用用户高德 Key 在线验证 POI、地理编码和路线
- [x] Demo `search_knowledge` 返回来源和版本
- [ ] 使用用户正式资料验证真实检索、Embedding 和引用
- [x] Demo 至少三类工具组合
- [x] 工具失败不编造
- [x] 调试面板显示工具、耗时、来源、结果数

## P0 RAG

- [x] 文章/版本/切片分表迁移
- [x] 只检索已发布有效版本的代码和测试
- [x] 1024 维 embedding 契约
- [x] 混合检索 RPC 迁移和测试
- [x] 21 个 Demo QA 评测样例
- [x] 无依据拒答
- [ ] 使用正式材料运行真实检索与生成评测

## P0 知识闭环

- [x] 回答反馈
- [x] 低置信/点踩生成候选
- [x] 候选发布前不可检索
- [x] Demo Admin 审核发布
- [x] Demo 发布后索引和评测
- [ ] Supabase 中持久化完成候选、审核、发布、索引和评测闭环

## P1

- [x] qwen3-rerank Adapter 与契约测试
- [ ] qwen3-rerank 在线调用验证
- [x] 摘要和长期偏好代码与测试
- [x] 地理编码和步行路线 Adapter 与降级测试
- [ ] 地理编码和步行路线在线调用验证
- [x] embedding 状态字段和发布后索引流程
- [ ] 独立 worker 的队列式 embedding
- [x] 知识运营页的 Demo 评测指标
- [ ] 可观察趋势和线上质量的生产 RAG 仪表盘
- [ ] Vercel staging/preview 部署与冒烟
- [x] 单实例错误与耗时统计
- [ ] Token 成本统计和集中可观测平台

## 演示通过

本地 Demo 已连续成功：

1. 精确房源查询
2. 带来源的退款规则
3. 房源 + 超市 + 宠物规则组合任务

正式发布仍需三个在线链路分别通过：Supabase 业务数据、高德位置服务、千问与正式知识检索。详细证据和当前阻塞见 `docs/task-reports/2026-08-11-task-12-local-release-readiness.md`。
