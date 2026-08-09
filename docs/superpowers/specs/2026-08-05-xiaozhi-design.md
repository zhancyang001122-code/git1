# 小智本地生活 AI 服务助手设计规格

**日期：** 2026-08-05  
**状态：** 已确认  
**实现形态：** Next.js 移动端 Web，Vercel 部署  
**核心原则：** 完整需求保留，按依赖分阶段实现；方案 B 统一设计系统；小智是主价值。

## 1. 目标与成功定义

小智把本地生活传统页面、自然语言入口、业务数据库、地图实时服务和企业客服知识连接到一个可解释 Agent 中。作品既要有完整产品形态，也要能在面试中演示以下闭环：

1. 用户自然语言表达多条件需求。
2. Agent 判断结构化业务、地图、知识或用户记忆工具。
3. 应用执行工具，展示进度和结构化结果。
4. 关键事实可追溯，失败时可降级且不编造。
5. 低置信与用户纠错生成知识候选，审核后发布、索引和评测。

三条主演示链路必须稳定：结构化房源查询、带引用的 RAG 回答、房源 + 周边 + 规则多工具任务。

## 2. 产品范围

### 主导航

首页、推荐、小智、消息、我的。所有主页面复用唯一底部导航，中间的小智按钮突出。

### 完整页面

首页、推荐与详情、小智欢迎/对话/历史、消息、我的、偏好、反馈、房源列表/详情、团购列表/详情、超市/商品/购物车、周边服务、知识运营演示。

### 交易边界

收藏、购物车、演示订单、预约和退款入口保留，支付、真实核销、签约、结算和履约采用清晰标注的模拟流程。项目不伪装成真实商业平台。

## 3. 视觉与交互

设计基准宽度 430px，支持 360–430px，桌面端居中。页面边距 16px、顶部栏 56px、搜索框 48px、底部导航 76px + safe area、中央小智按钮 64px。字号限制为 12/13/14/16/18/24/28px，普通卡片圆角 16px，大模块 20px。

九张原型图定义页面内容和视觉气质，不定义每页独立尺寸。所有颜色、间距、字号、圆角和阴影通过 token 管理。页面通过公共布局、通用组件、业务卡片和 AI 组件组装。

小智对话必须同时服务普通用户和面试展示：默认只显示“正在查询房源”等可理解进度；开启调试面板后显示工具名、参数摘要、来源、结果数、耗时和错误码，不展示隐藏推理。

## 4. 系统架构

```text
Next.js UI
  -> Application Services
      -> Agent Orchestrator
          -> Business Tool Port -> Supabase repositories
          -> Maps Tool Port -> AMap adapter
          -> Knowledge Tool Port -> Knowledge Service -> pgvector/hybrid search
          -> User Memory Port -> Supabase preferences
      -> Conversation / AI Ops repositories
```

应用代码创建在 `web/`，规格、迁移和原型保留在仓库根目录。React Server Components 用于默认读取，交互区域使用 client components；外部服务只能由 server-side Route Handlers 或 server modules 调用。

职责独立不等于物理数据库必须分开。当前一个 Supabase PostgreSQL 项目承载多个数据域，代码通过明确 service/repository 边界隔离。企业化后可按 SLA、团队、权限和扩容需求拆服务。

## 5. Agent 与工具

Qwen 通过百炼北京地域 OpenAI-compatible Chat Completions 接入。模型只负责理解、选择工具和组织结果，应用执行工具。工具采用 strict JSON Schema + Zod 双重校验，最多 8 轮，同轮相同工具和参数去重。

基础工具：

- Business：房源、团购、商品、库存。
- Maps：地理编码、周边 POI、步行路线。
- Knowledge：混合检索正式知识。
- Memory：读取与保存明确授权偏好。
- Feedback：记录反馈并形成待审核候选。

复杂问题按依赖执行。例如“3500 以内、能养猫、附近有超市并解释宠物责任”：先查询房源，缩小候选后查询周边，再检索宠物规则，最后综合排序。任一非关键工具失败时保留其他结果并明确未核验项。

## 6. 数据与 RAG

结构化业务事实使用 Supabase 普通表；位置与路线来自高德；客服规则使用 Knowledge Service。公共知识、个人偏好和当前对话上下文严格分离。

RAG 数据模型：

- `kb_articles`：知识身份和负责人。
- `kb_article_versions`：权威内容、版本、状态、生效区间和审核信息。
- `kb_chunks`：可重建检索索引、metadata 和 1024 维 embedding。

检索流程：查询改写 → metadata 过滤 → `text-embedding-v4` → 向量 + pg_trgm 混合召回 → 可选 `qwen3-rerank` → 去重 → 阈值判断 → 带引用生成。仅 published、当前有效版本可检索。低置信、版本冲突或无依据时不得确定性回答。

知识进化不是模型自动学习。低置信、无结果、点踩、纠错和重复问题只创建 `knowledge_candidates`；经过证据补充、人工审核、版本发布、重新切片、embedding 和回归评测后，知识才上线。

## 7. 数据流与 API

`POST /api/chat` 返回 SSE：session、tool_progress、result_cards、assistant_delta、citations、debug_tool_run、warning、done/error。结构化卡片与文本分离，避免模型生成 UI 数据。

页面读取通过 repository；浏览器仅使用 publishable Supabase key 和 RLS。service role、Qwen key、高德 Web Service key仅服务端存在。外部响应必须校验、超时并映射稳定错误码。

配置缺失时允许显式 demo fallback，但 UI 和健康页必须显示真实、fallback 或 unavailable 状态，不得假装真实服务已接通。

## 8. 错误处理、隐私和可观测性

- 所有外部调用支持 AbortSignal、超时和有限重试。
- 高德失败：保留房源结果，不编造附近商户和分钟数。
- RAG 低置信：显示依据不足、提交纠错或转人工。
- Qwen 失败：保留已执行的结构化结果，并给可重试提示。
- Supabase 失败：有缓存/fixture 时显示 demo fallback，否则错误态。
- 日志包含 request id、模型/工具耗时、结果数、检索分数和错误码；不记录密钥、完整系统 prompt 和不必要的个人数据。
- 用户长期偏好需要明确同意，可关闭和删除；不把偏好写入公共知识库。

## 9. 测试与交付

Unit：contracts、工具路由、循环上限、数据映射、RAG 融合、记忆优先级。  
Component：导航、卡片、SSE reducer、工具进度、引用。  
Integration：API、repository、Qwen/AMap fixture、Knowledge Service。  
E2E：完整页面、三条主演示、知识闭环、服务降级、360/390/430px。

每个 Task 完成后必须运行 lint、typecheck、unit tests 和 build；涉及页面或链路时增加 Playwright。最终 Vercel Root Directory 为 `web/`，并保留录屏作为网络故障备份。

## 10. 关键取舍

- 选 Next.js Web 而非微信小程序：降低审核和域名限制，面试官可直接打开，同时保留小程序视觉。
- 选 Supabase 而非 MySQL + 自建后端：快速获得 PostgreSQL、API、Auth、RLS 和 pgvector，但通过 repository 避免平台锁死。
- 选原生工具循环而非首版 LangGraph：工具数量和流程可控，更容易解释和测试；复杂并行、长流程和人工节点增加后再评估图编排。
- RAG 存储暂用 Supabase，但 Knowledge Service 独立：后续可迁移到专用搜索或知识平台，不影响 Agent 契约。
- 完整需求保留但分阶段：每个里程碑都可运行，避免一次性生成不可维护代码。
