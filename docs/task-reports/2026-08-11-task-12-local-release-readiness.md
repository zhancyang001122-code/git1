# Task 12 — 本地发布准备与验收映射

## 已有证据

| 验收域         | 当前结论                           | 证据                                                                        |
| -------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| 工程门禁       | 本地已通过                         | lint、typecheck、Vitest、production build、Playwright 全量命令              |
| 视觉与页面     | Demo 已通过                        | 26 个路由模板、360/390/430px 无横向溢出、统一导航与交互状态 E2E             |
| 结构化业务工具 | Demo 已通过，Live 未验证           | 房源、团购、商品、库存工具单测与浏览器结果卡；Supabase Live 账号尚未配置    |
| 地图工具       | Adapter 与降级已通过，Live 未验证  | 高德 fixture、超时、鉴权、配额、幂等重试、熔断及多工具 E2E                  |
| AI 对话        | 协议与 Demo 已通过，Live 未验证    | SSE、工具轮次、取消、超时、上下文与 Qwen Adapter 单测；百炼 Key 尚未配置    |
| RAG            | 架构与 Demo 已通过，正式资料未验证 | 文章/版本/切片迁移、1024 维校验、混合检索、Rerank、引用、21 个 QA 评测案例  |
| 知识闭环       | Demo 已通过，Live 持久化未启用     | 候选、审核、发布、索引、评测、回滚单测与知识进化 E2E                        |
| 安全与稳定性   | 单实例实现已通过                   | RLS 静态验证、请求 ID、脱敏、体积限制、限流、超时、重试、熔断和注入边界测试 |
| 性能预算       | 本地构建已通过                     | 首页导航 <10s、脚本传输 <2MB、脚本数 <40 的 Playwright 预算                 |

## 当前不能宣称完成的事项

1. 没有 Vercel Production URL，无法执行生产环境冒烟、手机二维码实测和线上源码密钥检查。
2. 没有远程 Supabase 项目，迁移、RLS HTTP 验证、2024 房源导入和持久化对话尚未实测。
3. 没有百炼与高德服务端配置，真实模型、Embedding、Rerank、POI 和路线尚未调用。
4. 没有正式客服资料，当前知识内容只能作为明确标注的虚构演示资料。
5. 多实例分布式限流、集中日志和告警平台尚未接入。
6. 因上述事项未完成，不创建 `xiaozhi-interview-v1` 标签，也不写“生产发布完成”。

## 本地发布证据

- `pnpm db:check`：PASS，11 个迁移、26 张表静态 RLS 覆盖通过。
- 隔离 `pgvector/pgvector:pg16` 临时数据库：11 个迁移从空库顺序执行成功。
- `pnpm db:verify-rls`：PASS，匿名只读、匿名越权拒绝、本人偏好、跨用户隔离、反馈 upsert、service role 写入等 9 个边界通过。
- 面试主演示 E2E：PASS，首页搜索、房源工具、RAG 引用、点踩候选和三工具组合连续成功。
- 前端预览：26 张页面长截图与 1 个索引页生成在仓库外 `C:\Users\Administrator\Desktop\git1-preview-20260811`。
- `pnpm lint`：PASS。
- `pnpm typecheck`：PASS。
- `pnpm test`：PASS，86 个测试文件、296 条测试。
- `pnpm build`：PASS，37 个页面/路由完成生产构建。
- `PLAYWRIGHT_PORT=3312 pnpm test:e2e`：PASS，Chromium 46/46。
- `.next/static` 浏览器产物扫描：未发现 `SUPABASE_SERVICE_ROLE_KEY`、`DASHSCOPE_API_KEY`、`AMAP_WEB_SERVICE_KEY` 或 Playwright 管理口令。

## 外部接入后的完成顺序

1. 用户提供已脱敏资料及来源、版本、负责人、生效日期和适用范围。
2. 配置 Supabase 并执行迁移、RLS HTTP 验证和历史房源导入。
3. 配置百炼与高德，生成正式知识 Embedding，运行 21+ 评测案例。
4. 部署 Vercel Preview，执行 staging smoke；通过后部署 Production。
5. 执行生产冒烟、手机二维码和三分钟录屏。
6. 复核所有验收项后再创建 release commit 和 `xiaozhi-interview-v1` 标签。
