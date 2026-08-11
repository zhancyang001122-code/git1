# AI Ops 人民币成本估算证据

日期：2026-08-12

## 结论

Production 已支持按真实记录的每次 `qwen-plus` 请求 Token 估算人民币成本。该数值是基于中国内地（北京）非思考模式公开原价的工程估算，不是阿里云账单。

## 定价依据与边界

- 官方来源：[`qwen-plus` 模型价格](https://help.aliyun.com/zh/model-studio/qwen-plus)
- 核验日：2026-08-12
- 输入不超过 128K：输入 ¥0.8 / 百万 Token，输出 ¥2 / 百万 Token
- 输入大于 128K 且不超过 256K：输入 ¥2.4 / 百万 Token，输出 ¥20 / 百万 Token
- 输入大于 256K 且不超过 1M：输入 ¥4.8 / 百万 Token，输出 ¥48 / 百万 Token
- 不计入免费额度、折扣、缓存价格、Embedding 与 Rerank；价格配置变化后必须同步更新分档、核验日和来源。
- [`text-embedding-v4` 官方接口与价格](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api/)说明响应含 `usage.prompt_tokens`，但本项目当前没有持久化该字段，因此 UI 明确排除 Embedding，不能补造成本。

## 实现证据

- `get_ai_model_usage(168)` 仅允许 `service_role` 执行，返回按 `model_name + input_tokens + output_tokens` 聚合的请求桶，不加载对话正文。
- 应用对每个请求桶独立选择输入长度档位，再乘以桶内请求数；不同模型、缺失 Token 或超出档位保持未计价，并显示覆盖率。
- 五项环境变量必须同时存在，价格档位必须按最大输入 Token 严格递增，否则配置校验失败。
- 管理页显示估算金额、完整/部分覆盖、模型模式、核验日、官方来源和排除项。

## 线上验证

- Supabase migration `202608120020_ai_model_cost.sql` 已应用到远端。
- Vercel Production 已配置 `qwen-plus` 非思考模式价格元数据并重新部署：`dpl_8rJrfrZMHXMXDGxdyPUtoeYGwFxq`，状态 `READY`，已绑定 `https://xiaozhi-local-life.vercel.app`。
- 远端 RPC 验证：31 个用量桶、31 次请求、31 次已覆盖、0 次未计价，按当时记录估算为 ¥0.295433。该金额会随 7 天滚动窗口变化，只作为当次证据。
- Production 全链路验证通过：Live health、移动端布局、历史房源、高德、商品、偏好提案与反馈闭环均通过。

## 验证命令

```powershell
cd web
pnpm db:check
pnpm db:test
pnpm test
pnpm typecheck
pnpm lint
pnpm build
$env:EXPECTED_PRODUCTION_MODE='live'
pnpm deploy:verify-production
```
