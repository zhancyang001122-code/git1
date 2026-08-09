# 测试矩阵

| 层级 | 对象 | 工具 | 关键断言 |
|---|---|---|---|
| Unit | domain mapper | Vitest | snake_case 正确映射、非法行拒绝 |
| Unit | tool schemas | Vitest | strict 参数、边界、未知字段拒绝 |
| Unit | tool loop | Vitest | 8 轮上限、重复调用去重、abort |
| Unit | RAG fusion | Vitest | 权重、阈值、去重、引用 |
| Unit | memory precedence | Vitest | 当前条件覆盖长期偏好 |
| Component | BottomNavigation | Testing Library | 活动状态、5 项、中央按钮 |
| Component | Chat stream reducer | Testing Library | 乱序保护、错误、重试、卡片 |
| Component | KnowledgeSources | Testing Library | 标题、版本、生效日期、展开 |
| Repository | Supabase adapters | Vitest fake | filters、pagination、error mapping |
| Integration | `/api/chat` | Vitest | SSE event contract、tool results |
| Integration | Knowledge Service | fixture/fake | published/effective filter、fallback |
| Integration | Maps Service | fixture/fake | geocode、POI、route、quota error |
| E2E | main nav/pages | Playwright | 路由、360/390/430px、无溢出 |
| E2E | business query | Playwright | 结果与 Supabase seed 一致 |
| E2E | RAG citation | Playwright | citation 可见、缺口拒答 |
| E2E | multi-tool | Playwright | 进度顺序、部分失败降级 |
| E2E | knowledge loop | Playwright | candidate→review→publish→answer |
| Build | production build | Next.js | 无服务端密钥泄漏、构建通过 |

## Fixture 原则

- CI 不调用真实 Qwen、AMap 或生产 Supabase。
- 真实服务只在受控 staging smoke test 中调用。
- 每个外部适配器保存经过脱敏的成功、空结果、超时、限流和 malformed fixtures。
- 快照不得包含 token、手机号、精确个人地址或 API Key。
