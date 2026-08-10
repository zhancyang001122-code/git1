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

- 现象：版本已发布但 `indexStatus=failed`，不可检索。
- 处理：检查 Embedding 模型、维度、配额和失败切片。不要宣称上线成功。
- 恢复：重建失败版本索引并运行关联评测；评测失败且有上一版本时执行回滚。

### 限流误伤

- 现象：429 与 `retry-after`。
- 处理：本地/单实例检查窗口计数；多实例部署改用共享 Redis/Upstash，不能依赖进程内 Map。

## 恢复完成标准

- `/api/health` 状态正确且不泄漏配置值。
- 相关核心场景连续成功三次。
- 日志无密钥和个人隐私。
- 失败期间产生的知识、反馈和工具记录没有越权或重复发布。
- 故障原因、影响范围、requestId、修复和预防措施已记录。
