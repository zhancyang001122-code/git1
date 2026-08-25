# 租房决策主演示 Production 交付报告

## 结论

`https://xiaozhi.zaneyang.xyz` 已在提交 `b0a1ae2b2076243b61e0417a5695f11ce9303367` 上通过租房决策 Production 预检。一个用户问题能够同时获得：

1. Supabase 中的 2024-11 历史房源卡；
2. 高德 Web Service 返回的周边地点卡；
3. 已发布官方租赁资料的 RAG 引用；
4. 千问基于上述证据组织的完整回答。

这证明当前公开作品集边界中的多工具编排和 RAG 链路已接通，不证明房源当前可租，也不证明真实客户 ROI。

## 本次交付

- 首页和小智页聚焦“预算筛房 → 周边核验 → 签约依据”这一条主演示。
- 新增案例页 `/case-study`，公开问题、来源分工、工程证据和诚实边界。
- Knowledge Service 支持 `public_official` 材料类型；引用包含标题、版本、生效日期、`chunkId` 和 HTTPS 原文。
- Supabase 迁移 `202608250001_public_official_knowledge.sql` 已应用到远端，并把分类、草稿写入和检索 RPC 收紧到服务端角色。
- 国家《住房租赁条例》和杭州租房风险提示两份官方公开资料已完成发布、Embedding 和索引。
- 为三工具主演示保留 55 秒应用超时与 60 秒路由上限；单个工具仍受独立 8 秒上限约束。
- 生产验收不要求公开 `debug_tool_run`。房源卡、地点卡和官方引用是用户可见且可核验的成功证据；线上调试开关保持关闭。

## 固定评测

| 评测对象           |  结果 | 含义                          |
| ------------------ | ----: | ----------------------------- |
| 作品集首方知识检索 | 20/20 | 固定检索问题通过              |
| 作品集首方千问生成 |   4/4 | 强制取证、事实和引用边界通过  |
| 官方租赁知识       | 10/10 | 8 条检索与 2 条无依据拒答通过 |

## Production 预检

执行：

```powershell
cd web
pnpm interview:preflight
```

结果：

```text
PASS deployment live health, mobile layout, housing, maps, commerce, preference proposal and feedback flow.
status=PASS
commit=b0a1ae2b2076243b61e0417a5695f11ce9303367
amap=live/geocoding
firstPartyRag=grounded/cited
rentalDecision=housing+amap+official-rag
liveFlow=PASS
```

该预检还验证：

- Production SHA 与本地当前提交一致；
- Supabase、Qwen、AMap、Housing 均为 `configured`，运行模式为 `live`；
- 非法聊天请求稳定返回 `400/INVALID_CHAT_REQUEST`；
- 高德地理编码真实返回武林广场坐标；
- 首方 RAG 返回目标材料与版本化引用，未触发规则兜底；
- 租房主任务返回完整回答、房源卡、地点卡和官方引用，未触发规则兜底；
- 430px 移动端页面无横向溢出，Live 房源、高德、偏好提案和反馈流程可操作。

预检会向 Production 写入三条测试对话和一条反馈，不应被当作高频监控命令。

## 工程质量

本轮质量门结果：

```text
pnpm lint       PASS
pnpm typecheck  PASS
pnpm test       PASS (135 files, 577 tests)
pnpm build      PASS
pnpm test:e2e   PASS (53 passed, 1 skipped)
```

跳过项是只在本机历史房源 HTTP 服务启动时才执行的专项用例；Production 房源链路由上述在线预检单独覆盖。

## 安全与边界

- 浏览器不持有 Supabase 管理密钥、高德 Web Service Key 或百炼 Key。
- 所有知识表启用 RLS；官方知识检索与发布写操作只通过服务端边界执行。
- Production 不公开工具参数和调试运行事件。
- 官方资料摘要不构成法律意见，回答要求用户打开原文并核对所在地最新流程。
- Supabase 安全顾问仍提示 Auth 的泄露密码保护未开启；当前公开入口只映射隔离演示账号且不开放用户注册，因此不能称为生产级认证系统。

## 仍未完成

- 尚未邀请 3–5 位杭州或绍兴目标用户完成任务测试，因此不填写节省时间、转化率或满意度数字。
- 尚无经授权的企业客服话术、内部制度或 CRM/ERP 材料，不能宣称完成企业知识库交付。
- `qwen3-rerank` 后续已完成独立在线调用、Production 启用和实际检索重排验证，见 `docs/task-reports/2026-08-25-qwen-rerank-and-entrypoints.md`。
- 外部告警通知和真实值班升级尚未接入。

下一阶段应先执行 `docs/21-user-validation-protocol.md`，收集用户成功率、耗时、证据理解和失败点，再决定是否继续扩充功能。
