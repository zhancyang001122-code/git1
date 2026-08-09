# 企业级深化路线

## E1 可控试点

- Auth/企业身份
- RBAC：用户、运营、审核员、管理员
- 正式知识后台
- dev/staging/prod
- 审计、隐私、评测门禁
- 限流、配额、成本仪表盘

## E2 服务化

- 拆 Business、Knowledge、Conversation、AI Gateway
- 队列处理 embedding、评测、摘要、候选知识
- 统一 Tool Gateway
- 多客户端复用时增加 MCP Adapter，不重写领域逻辑
- Provider 可替换
- 热点缓存

## E3 多租户和合规

- tenant_id 全链路隔离
- 每租户知识、Prompt、工具权限
- SSO、SCIM、RBAC/ABAC
- 数据地域、保留、删除
- PII 识别、脱敏、审计
- Prompt/知识发布审批

## E4 智能运营

- 聚类高频未解决问题
- 识别冲突、过期和覆盖缺口
- 自动生成评测样例草稿
- A/B 测试模型和检索
- 模型路由
- 成本/质量/延迟优化

## E5 生产 SLA

- 容灾、备份恢复演练
- 队列幂等、重放、死信
- 灰度、回滚、Feature Flag
- SLO 和错误预算
- 红队：越权、注入、泄露、工具滥用

## 面试表达

> Demo 采用单个 Supabase 降低交付复杂度，但通过领域接口保持边界。企业化优先补权限、审计、评测和知识治理；只有团队、流量、合规或 SLA 出现明确需求时再拆物理服务。
