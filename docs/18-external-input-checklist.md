# 外部输入清单

这份清单只列当前必须由项目作者提供、选择或在账号后台确认的内容。代码、Supabase、千问生成、高德、历史房源、共享限流和 Production 部署已经有在线证据，不需要重复配置。

## 面试前 P0

### 1. 企业知识材料（作品集主演示已不阻塞）

四份作品集首方公开资料已经完成 Production 真实索引和 20/20 固定评测，可以支撑面试中的 RAG 主演示。以下输入只在要进一步证明“能交付企业客户知识库”时需要，不能由 Codex 虚构：

先准备 3–10 份能够公开用于面试演示的真实资料，Markdown、Word 或 PDF 均可。每份资料同时说明：

- 标题和业务类型；
- 来源或负责人；
- 版本号、生效日期和失效日期；
- 正文，以及哪些内容已经脱敏；
- 是否允许作为作品集演示资料。

再准备 10–20 个验收问题，其中至少包含：能直接回答、需要组合两份资料、资料中没有答案而应拒答、旧版本与新版本冲突四类。每题写明预期答案和应引用的资料。没有这些材料时，现有首方知识可以证明作品集内容和系统链路，不能证明真实企业内容质量。

不要把密钥、身份证号、手机号、客户名单或未获授权的内部文件放进仓库。材料可先单独发给 Codex 审计和脱敏，再决定是否导入 Supabase。

### 2. Production 管理口令（已完成）

已使用机器生成的 256-bit 随机口令完成配置：Vercel Production 保存为不可回读的 Sensitive 变量，本机副本保存到 Windows 凭据管理器。口令未提交 Git、未写入 `.env.local`、URL 或截图。

在线验收已覆盖登录 `/knowledge-admin/login`、RAG/AI Ops 页面、Cookie 安全属性、主动退出和重新保护。作者需要登录时，在 `web/` 运行 `.\scripts\copy-admin-token.ps1`，粘贴后立即用 `Set-Clipboard -Value $null` 清空剪贴板。

### 3. 固定演示码 Auth（邮箱和 SMTP 已取消）

Production 使用现有域名的独立子域名 `xiaozhi.zaneyang.xyz`，没有移动或覆盖作品集根域名。Vercel 绑定、阿里云 DNS、TLS、Supabase Auth Site URL 和完整 Live 回归均已完成，证据见 `docs/task-reports/2026-08-13-production-domain.md`。

作者已决定不接入邮箱和 SMTP。当前方案为公开固定演示码 `666666`：服务端把它映射到独立 Supabase 演示账号，真实随机密码只保存在 Vercel Sensitive 环境变量，浏览器和仓库均不可见；登录后仍使用 Supabase Session、`auth.getUser()` 与 RLS。

该账号由体验者共享，页面明确提示不要填写真实隐私，并提供关闭长期记忆、删除整行偏好的清理动作。这个方案适合低频作品集演示，不等于生产级用户认证；若将来开放真实用户注册，应恢复邮箱/OAuth、滥用防护和独立用户身份。

### 4. Vercel 连接 GitHub

GitHub App 已按最小范围安装，只授权公开仓库 `zhancyang001122-code/git1`，没有授权其他仓库。Vercel 项目已经连接该仓库，Production Branch 为 `codex/housing-http-adapter`，Root Directory 已修正并核验为 `web`。

首次自动部署 canary 已验收：提交 `ea820c2` 触发 GitHub 来源的 Vercel Production deployment `dpl_DP1fXV5mwWfN5PLgXq3mprxSTMzc`，提交 SHA 精确匹配，状态为 `READY` / `PROMOTED`，正式别名完成切换，完整 Production Live 回归通过。详细证据见 `docs/task-reports/2026-08-13-vercel-github-connection.md`。

## 可以延后的增强项

### 5. qwen3-rerank 在线验证

当前 RAG 已使用真实 Embedding、pgvector 混合检索和版本化引用，主演示不依赖 rerank。若要启用 qwen3-rerank，还需要从百炼工作空间复制专属 `compatible-api/v1` 地址，写入 `DASHSCOPE_RERANK_BASE_URL`，再设置 `RAG_RERANK_ENABLED=true`。普通百炼 API Key 不能推导这个工作空间地址。

启用前后应使用同一批正式评测问题比较命中率、排序质量、延迟和费用；不能只因为模型可调用就宣称质量提升。

### 6. 外部告警和值班平台

当前已有 Supabase 跨实例工具审计、全部 API Route 安全元数据、RAG 日趋势、六类站内阈值状态（含首 Token P95 和单会话成本估算），以及持久化事故的认领、解决、自动恢复和不可变事件审计，足够支撑低频面试演示。完整外部告警仍需要作者选择长期使用的平台、通知渠道、接收人和真实值班升级规则。

这不是主演示阻塞项。没有真实团队和值班责任人时，提前搭建复杂告警链只会增加维护成本，不能证明真实事故响应能力。

## 完成顺序

1. Production 管理口令（已完成）；
2. 作品集首方资料与评测（已完成）；
3. 固定演示码 Production Auth（已完成）；
4. Vercel GitHub OAuth（已完成）；
5. 获得经授权的企业材料后建立独立评测集；
6. 有企业评测集后再决定是否启用 rerank；
7. 有真实通知接收人后再接外部告警。
