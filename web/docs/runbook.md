# 小智运行手册

## 快速判定

1. 打开 `/api/health`，确认 `mode` 与页面标识一致。
2. 记录响应头 `x-request-id`，用它关联结构化日志。
3. 判断故障属于 Supabase、Qwen、AMap、RAG 索引还是应用本身。
4. 不复制完整 Prompt、Cookie、Token、手机号或精确地址到工单和日志。

## 降级开关

- `NEXT_PUBLIC_DEMO_MODE=true`：整站进入明确标注的确定性 Demo。切换后必须重新部署。
- `SUPABASE_FALLBACK_TO_DEMO=true`：仅在明确批准的演示环境允许业务读取可见回退；生产默认 `false`。
- `RAG_RERANK_ENABLED=false`：Rerank 不可用时保留混合检索，不影响引用边界。
- `NEXT_PUBLIC_ENABLE_AI_DEBUG=false`：公开环境关闭前端调试摘要。

禁止在 Live 故障时静默返回 Mock；所有回退必须在 UI 和响应来源中可见。

## 常见故障

### Qwen 超时或熔断

- 现象：`QWEN_PROVIDER_FAILED`、`CIRCUIT_OPEN` 或整体 30 秒超时。
- 处理：检查百炼地域、模型名、配额和 Key；千问生成非幂等，不自动重试。
- 恢复：等待 30 秒冷却，使用最小问答冒烟；仍失败则保持 Demo 或明确不可用状态。

### 高德不可用

- 现象：`AMAP_TIMEOUT`、`AMAP_QUOTA`、`AMAP_UNAUTHORIZED`。
- 处理：检查 Web 服务 Key、配额和 Host。只对幂等 GET 的瞬时故障重试一次。
- 恢复：验证地理编码、周边 POI、步行路线；恢复前不得展示估算距离。

### 本机历史房源服务不可用

- 现象：`HOUSING_TIMEOUT`、`HOUSING_DATA_UNAVAILABLE`、`HOUSING_UNAUTHORIZED` 或 `CIRCUIT_OPEN`。
- 处理：先访问房源服务 `/health`；核对 `HOUSING_DB_PATH`、两端一致的 `HOUSING_API_KEY`、8000 端口和 SQLite 文件权限。浏览器不能直接持有房源 API Key。
- 数据边界：只支持杭州 2024-11 历史快照；默认中心为武林广场 WGS84 坐标；宠物政策缺失时必须拒绝对应筛选。
- 恢复：运行房源服务的 `pytest`、`ruff`、`mypy`，再执行带 `HOUSING_API_BASE_URL` 的 `e2e/housing-http.spec.ts`。禁止把失败静默伪装成真实历史查询。

### Supabase 或 RLS 异常

- 现象：业务查询失败、跨用户请求被拒或迁移版本不一致。
- 处理：核对项目 URL、Key 类型、迁移顺序和 RLS Policy；禁止为绕过问题把 service role 发到浏览器。
- 恢复：运行 `pnpm db:check`、`pnpm db:verify-rls` 和受控环境下的 `pnpm db:verify-http`。

### RAG 索引失败

- 现象：版本已发布但长期停留在 `indexStatus=queued`，或达到最大重试次数后变为 `failed`；两种状态都不可检索。
- 处理：先检查 `knowledge_index_jobs` 的 `status`、`attempt_count`、`lease_expires_at` 和 `last_error_code`，再核对 Embedding 模型、维度与配额。不要把排队或失败描述为上线成功。
- 恢复：确认 `CRON_SECRET` 已配置后调用受保护的 `/api/internal/knowledge-index-worker`；失败任务可通过幂等 enqueue RPC 明确重新排队。评测失败且有上一版本时执行回滚。
- 调度边界：Hobby 计划的 `vercel.json` 只提供每日兜底调度，面试现场由已登录管理页即时处理；数据库租约负责多实例互斥，不能改成进程内锁。

### 限流误伤

- 现象：429 与 `retry-after`。
- Production 的 Chat、Feedback、公开 Knowledge Search、地图直连和受保护的知识评测：按 `scope` 检查 `api_rate_limit_windows` 的短时共享计数；只能使用 service role，禁止尝试恢复原始 IP。确认是误伤后等待 `retry-after`，不要直接删除所有作用域或提高全局阈值。
- `RATE_LIMIT_BACKEND_UNAVAILABLE`：检查远端 migration、service key 和 Supabase 可用性；成本敏感接口会 503 失败关闭，不会退回无限放行。
- Demo、管理发布/索引和低频单邮箱 OTP 仍有进程内计数；如果未来开放公众注册或高流量管理 API，再迁移到共享存储并增加 WAF/CAPTCHA，不把当前作品边界说成通用生产方案。

### AI Ops 站内告警

- 工具失败率告警：先在知识运营页按 `failed` 和 `timed_out` 查询，再按工具名、稳定错误码和 `requestId` 聚合。参数修复失败与外部服务超时都是真实质量信号，但处理方式不同；不能直接抬高阈值隐藏问题。
- RAG 零结果率告警：先区分正式资料覆盖不足、查询改写问题和版本未索引；不要用无来源回答填补零结果。
- 知识索引积压：检查失败任务、过期租约和等待超过 15 分钟的可执行任务，再按“RAG 索引失败”流程恢复。
- RAG 评测失败：暂停有风险的知识发布，检查失败用例、引用版本和最近变更；必要时回滚到上一已验证版本。
- `insufficient_data` 表示样本不足，不等于正常。当前告警只在受保护页面显示，不会主动发送外部通知；未接入值班平台前需要演示前主动检查。

## 恢复完成标准

- `/api/health` 状态正确且不泄漏配置值。
- 相关核心场景连续成功三次。
- 日志无密钥和个人隐私。
- 失败期间产生的知识、反馈和工具记录没有越权或重复发布。
- 故障原因、影响范围、requestId、修复和预防措施已记录。
