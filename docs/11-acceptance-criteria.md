# 验收标准

状态说明：`[x]` 表示已有仓库、本地集成或 Production 在线验证证据；`[ ]` 表示仍缺用户账号配置、正式材料或线上验证。不能用本地契约测试替代在线接通结论。

## P0 工程

- [x] `web/` 可安装启动
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] 核心 Playwright Demo 通过
- [x] 本地 Supabase + Mailpit Auth 专项 Playwright 通过

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
- [x] 用户偏好 GET/PATCH API、服务端授权时间、整行撤销与稳定错误

## P0 Auth、授权与隐私

- [x] 邮箱 6 位 OTP 本地 Mailpit 发送、验证与会话 Cookie
- [x] `/me/preferences` 未登录服务端跳转，并保留安全站内 `next`
- [x] 偏好 API 只从 `auth.getUser()` 获取用户 ID，不接受客户端 `userId`
- [x] SQL Role 与 PostgREST 两层验证本人可读写删、跨用户不可读改删、匿名不可访问
- [x] 模型偏好工具只生成无副作用提案；取消零写入，确认才调用 API
- [x] 关闭长期记忆删除整行偏好；登出不等同于删除数据
- [x] 面试演示 Auth 无 CAPTCHA；Production 单邮箱白名单在发送与验证两端均失败关闭
- [ ] 生产域名、自定义 SMTP、发件域名验证与真实邮箱冒烟
- [ ] 生产环境使用作者邮箱完成一次真实 OTP 冒烟

## P0 AI

- [x] 流式多轮协议、取消、超时和确定性 Demo Provider
- [x] 使用用户百炼账号在线验证千问流式多轮和 Function Calling
- [x] `search_houses` 可查询本机 2024-11 只读历史房源；未配置时明确降级
- [x] `search_houses` 查询用户远端 Supabase，并验证 60,202 条 2024-11 历史房源
- [x] `search_nearby_places` 的 Adapter、fixture 契约和缺 Key 降级
- [x] 使用用户高德 Key 在线验证 POI、地理编码和路线
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
- [x] Supabase 持久化候选、草稿、审核、发布、结果和回滚，Live 反馈 API 已完成远端冒烟
- [ ] 配置千问并用正式材料完成真实索引和评测闭环

## P1

- [x] qwen3-rerank Adapter 与契约测试
- [ ] qwen3-rerank 在线调用验证
- [x] 摘要和长期偏好代码与测试
- [x] 地理编码和步行路线 Adapter 与降级测试
- [x] 地理编码和步行路线在线调用验证
- [x] embedding 状态字段和发布后索引流程
- [x] 独立 Worker 的持久化队列式 embedding：原子入队、租约、`SKIP LOCKED`、退避重试、Vercel Cron 与管理页即时触发均已实现；四个 Demo 版本已完成 Production 真实 Embedding
- [x] 知识运营页的 Demo 评测指标
- [x] service-role RAG 日趋势 RPC、受保护质量视图与 Production 部署
- [ ] 配置 Production 管理口令并完成受保护 RAG 趋势页在线登录验收
- [x] 受保护的 Vercel Demo Preview 部署与冒烟；未复用 Production 数据库或密钥
- [ ] Vercel GitHub Login Connection 与自动部署；当前使用已验证的 CLI 手动部署
- [x] 单实例错误与耗时统计
- [x] service-role 专用的近 7 天 AI Ops 聚合：Token、工具失败、反馈、评测和知识库存
- [x] 按百炼模型价格配置计算人民币成本：逐请求按输入长度分档，显示覆盖率、价格核验日、官方来源和排除项，不冒充实际账单
- [ ] 完整跨实例日志检索、指标趋势和主动告警平台；已完成 Supabase 跨实例工具审计检索、RAG 日趋势和四类站内阈值状态，仍缺全部 Route 日志、外部通知、事故认领和值班升级

## 演示通过

本地 Demo 已连续成功：

1. 精确房源查询
2. 带来源的退款规则
3. 房源 + 超市 + 押金规则组合任务

Production Live 已连续通过“历史房源 + 高德”和“演示商品 + 偏好提案”真实千问编排，且反馈可写入远端 Supabase。四个明确标注 Demo 的知识版本已通过独立 Worker 生成真实百炼 Embedding，并在线返回版本化引用；这不等于正式知识材料验收，正式检索仍需用户提供真实材料。AI Ops 已能按线上逐请求 Token 和核验后的 `qwen-plus` 非思考模式公开原价估算人民币成本，但明确排除免费额度、优惠、Embedding 与 Rerank，因此不是阿里云账单。生产 Auth 仍需作者邮箱、域名和 SMTP 配置。Auth/偏好本地证据见 `docs/task-reports/2026-08-12-auth-preferences.md`；Production 基线见 `docs/task-reports/2026-08-12-vercel-production-baseline.md`；Worker 证据见 `docs/task-reports/2026-08-12-knowledge-index-worker.md`；成本估算证据见 `web/docs/task-reports/2026-08-12-ai-cost-estimate.md`。
