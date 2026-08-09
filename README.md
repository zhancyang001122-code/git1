# git1｜小智本地生活 AI 服务助手

这是一个面向 AI FDE / Solutions Engineer 面试的作品集项目。当前仓库已经纳入完整规格包，应用代码将在根目录的 `web/` 中逐步实现。

## 当前状态

- 当前阶段：Task 1，建立可运行、可测试、可部署的工程基础。
- 房源需求变更：后续接入用户已有的 2024 年真实历史房源数据，不再把房源查询统一视为 Mock。
- 数据真实性边界：2024 年房源只能描述为历史数据，不能暗示为实时在售、实时价格或实时库存；在尚未接入前，相关页面不得伪造成功结果。
- 团购与线上超市：在没有真实业务数据接口前继续使用显式标注的 Mock 数据。
- 高德地图：POI、地址和路线来自外部实时 API 时，界面需要标注来源并处理超时、限流和失败状态。

## 已锁定的技术方向

- 运行形态：移动端 Web，小程序视觉风格
- 前端：Next.js App Router + TypeScript + Tailwind CSS
- 部署：Vercel，Root Directory 为 `web/`
- 数据库：Supabase PostgreSQL
- AI：阿里云百炼通义千问，使用 OpenAI 兼容接口与 Function Calling
- RAG：独立 Knowledge Service；计划使用 Supabase pgvector，支持检索、引用、版本与评测
- 地图：高德 Web 服务 API 2.0
- 主导航：首页、推荐、小智、消息、我的

## 仓库目录

- `web/`：实际应用代码（Task 1 创建）
- `docs/`：需求、页面、架构、开发规范、配置和面试材料
- `codex/`：分阶段实施提示
- `contracts/`：TypeScript、API、SSE 与工具契约
- `supabase/migrations/`：数据库迁移和演示数据
- `design/prototypes/`：原型图与设计说明
- `qa/`：演示脚本、评测案例和测试矩阵
- `scripts/`：规格包辅助脚本
- `MANIFEST.md`：原始规格包文件清单与摘要

## 真实性与安全边界

- 价格、库存、政策、状态、距离不得由模型编造。
- 用户对话只能生成候选知识，不能自动进入正式知识库。
- `SUPABASE_SERVICE_ROLE_KEY`、`DASHSCOPE_API_KEY`、`AMAP_WEB_SERVICE_KEY` 只能在服务端使用。
- 商业 Mock 数据必须显式标注；外部实时数据必须标注来源。

完整验收标准见 `docs/11-acceptance-criteria.md`。
