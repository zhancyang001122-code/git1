# 验收标准

状态说明：`[x]` 表示已有仓库、本地集成或 Production 在线验证证据；`[ ]` 表示仍缺用户账号配置、正式材料或线上验证。不能用本地契约测试替代在线接通结论。

作者需要提供或确认的剩余输入及优先级见 `docs/18-external-input-checklist.md`。

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
- [x] 首页与周边均可打开共享位置选择；双栏按钮在 360px 不折叠错位

## P0 页面

- [x] 首页、推荐、小智、消息、我的
- [x] 房源、团购、超市、周边和详情
- [x] 收藏、购物车、偏好、对话历史、知识反馈
- [x] Mock 和模拟交易标识
- [x] 手动地点和浏览器定位写入同一浏览器级查询中心；地图、小智和历史房源使用正确坐标系
- [x] 首页和小智页把“租房决策”设为唯一主演示，并提供独立案例页

## P0 API 契约

- [x] 房源、团购、商品和社区内容只读列表 API
- [x] 严格查询参数、稳定错误、请求 ID 和来源封装
- [x] 反馈 API 验证消息归属，反馈不暴露为模型工具
- [x] 用户偏好 GET/PATCH API、服务端授权时间、整行撤销与稳定错误

## P0 Auth、授权与隐私

- [x] 历史邮箱 OTP 方案曾通过本地 Mailpit；当前固定演示码通过本地真实 Supabase Session/RLS E2E
- [x] `/me/preferences` 未登录服务端跳转，并保留安全站内 `next`
- [x] 偏好 API 只从 `auth.getUser()` 获取用户 ID，不接受客户端 `userId`
- [x] SQL Role 与 PostgREST 两层验证本人可读写删、跨用户不可读改删、匿名不可访问
- [x] 模型偏好工具只生成无副作用提案；取消零写入，确认才调用 API
- [x] 关闭长期记忆删除整行偏好；登出不等同于删除数据
- [x] 面试演示 Auth 无 CAPTCHA；公开固定码只映射服务端隔离演示账号，不下发 Supabase 凭据
- [x] Production 子域名、DNS、TLS、Supabase Auth Site URL 与完整 Live 回归
- [x] Production 固定演示码完成真实 Supabase Session、偏好、退出、重登和清理冒烟

## P0 AI

- [x] 流式多轮协议、取消、超时和确定性 Demo Provider
- [x] 使用用户百炼账号在线验证千问流式多轮和 Function Calling
- [x] `search_houses` 可查询本机 2024-11 只读历史房源；未配置时明确降级
- [x] `search_houses` 查询用户远端 Supabase，并验证 60,202 条 2024-11 历史房源
- [x] `search_nearby_places` 的 Adapter、fixture 契约和缺 Key 降级
- [x] 使用用户高德 Key 在线验证 POI、地理编码和路线
- [x] Demo `search_knowledge` 返回来源和版本
- [x] 使用 4 份作品集首方公开资料验证真实发布、Embedding、检索和引用
- [x] 两份官方公开租赁资料完成 Production 发布、真实 Embedding、原文链接与 10/10 固定评测
- [ ] 使用经授权的企业客服或制度资料验证客户场景内容质量
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
- [x] 使用作品集首方公开资料运行 Production 固定评测：20/20 通过；4/4 千问自然问法完成强制取证、事实、版本、首方来源与引用范围检查
- [ ] 租房主演示在 Production 同轮成功执行房源、高德、官方 RAG，并由预检验证三类证据
- [ ] 3–5 位目标用户完成任务测试；在此之前不填写效率提升或转化数字
- [ ] 使用经授权的企业资料运行客户场景检索与生成评测

## P0 知识闭环

- [x] 回答反馈
- [x] 低置信/点踩生成候选
- [x] 候选发布前不可检索
- [x] Demo Admin 审核发布
- [x] Demo 发布后索引和评测
- [x] Supabase 持久化候选、草稿、审核、发布、结果和回滚，Live 反馈 API 已完成远端冒烟
- [x] 受保护管理页可把人工材料原子录入为 `drafted` 候选，保留来源、负责人、版本号和有效期，且不能绕过审核直接进入检索
- [x] 配置千问并用作品集首方公开资料完成候选、审核、发布、真实索引和评测闭环
- [ ] 用经授权的企业资料完成同一知识治理闭环

## P1

- [x] qwen3-rerank Adapter 与契约测试
- [ ] qwen3-rerank 在线调用验证
- [x] 摘要和长期偏好代码与测试
- [x] 地理编码和步行路线 Adapter 与降级测试
- [x] 地理编码和步行路线在线调用验证
- [x] embedding 状态字段和发布后索引流程
- [x] 独立 Worker 的持久化队列式 embedding：原子入队、租约、`SKIP LOCKED`、退避重试、Vercel Cron 与管理页即时触发均已实现；四个 Demo 版本和四份作品集首方资料已完成 Production 真实 Embedding
- [x] 知识运营页的 Demo 评测指标
- [x] service-role RAG 日趋势 RPC、受保护质量视图与 Production 部署
- [x] Production 使用 256-bit 随机 Sensitive 管理口令；受保护 RAG/AI Ops 页面、Cookie 属性、主动退出和重新保护已在线验收
- [x] 受保护的 Vercel Demo Preview 部署与冒烟；未复用 Production 数据库或密钥
- [x] Vercel GitHub App 仅授权 `zhancyang001122-code/git1`；默认分支 push 已触发 SHA 精确匹配的 Production 自动部署并通过完整 Live 回归
- [x] 单实例错误与耗时统计
- [x] Chat、Feedback、公开 Knowledge Search 和地图直连使用 Supabase 原子共享限流；知识评测共用同一服务端边界且先鉴权后计数；HMAC 客户端摘要、RLS、service-role 专用 RPC 和 Production 写入已验证
- [x] Auth、偏好、Feedback 和管理 Cookie 写操作执行 Same-Origin 校验；Bearer 管理自动化保持独立，管理登录表单在解析前限制为 4 KiB
- [x] service-role 专用的近 7 天 AI Ops 聚合：Token、工具失败、反馈、评测和知识库存
- [x] 按百炼模型价格配置计算人民币成本：逐请求按输入长度分档，显示覆盖率、价格核验日、官方来源和排除项，不冒充实际账单
- [ ] 完整跨实例日志检索、指标趋势和主动告警平台；已完成 Supabase 跨实例工具审计、全部 API Route 安全元数据检索、RAG 日趋势、六类站内阈值状态（含首 Token P95 和单会话成本估算），以及事故认领/解决/自动恢复与不可变事件审计，仍缺外部通知和真实值班升级

## 演示通过

本地 Demo 已连续成功：

1. 精确房源查询
2. 带来源的退款规则
3. 房源 + 超市 + 押金规则组合任务

Production Live 已连续通过“历史房源 + 高德”和“演示商品 + 偏好提案”真实千问编排，且反馈可写入远端 Supabase。四份作品集首方公开资料已完成受控发布、真实百炼 Embedding、Production 检索和版本化引用；固定评测 20/20 通过，其中 4/4 千问生成用例通过。该证据证明作品集公开边界的 RAG 链路和内容质量，不等于真实企业客服资料已经交付。AI Ops 已能按线上逐请求 Token 和核验后的 `qwen-plus` 非思考模式公开原价估算人民币成本，但明确排除免费额度、优惠、Embedding 与 Rerank，因此不是阿里云账单。Production 管理页已使用 Sensitive 随机口令完成登录、Cookie 和主动退出验收；`xiaozhi.zaneyang.xyz` 已完成 DNS、TLS、Supabase Site URL 和完整 Live 回归。根据作者 2026-08-13 的新决策，邮箱 OTP 与 SMTP 已从当前范围移除，改为公开固定演示码映射到隔离 Supabase 演示账号；它用于作品集体验，不冒充生产级用户认证。Auth/偏好历史 OTP 证据见 `docs/task-reports/2026-08-12-auth-preferences.md`；当前固定演示码证据见 `docs/task-reports/2026-08-13-fixed-demo-auth.md`；Production 基线见 `docs/task-reports/2026-08-12-vercel-production-baseline.md`；自定义域名见 `docs/task-reports/2026-08-13-production-domain.md`；首方 RAG 证据见 `docs/task-reports/2026-08-13-portfolio-first-party-rag.md`；RAG 恢复证据见 `docs/task-reports/2026-08-13-rag-embedding-recovery.md`；管理会话见 `web/docs/task-reports/2026-08-12-production-admin-session.md`；Worker 证据见 `docs/task-reports/2026-08-12-knowledge-index-worker.md`；成本估算证据见 `web/docs/task-reports/2026-08-12-ai-cost-estimate.md`。
