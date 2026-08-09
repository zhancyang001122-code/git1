# Phase 1：工程脚手架

执行实施计划 Task 1。核心要求：

1. 在规格仓库根目录初始化 Git（若尚未初始化）。
2. 运行：

```bash
pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --turbopack --import-alias '@/*' --use-pnpm
```

3. 将 `config/.env.example` 复制为 `web/.env.example`，不要创建真实密钥。
4. 配置：
   - `pnpm test`
   - `pnpm test:watch`
   - `pnpm test:e2e`
   - `pnpm typecheck`
   - `pnpm format:check`
5. 建立 `src/lib/env.ts`，服务端和客户端环境变量分开验证；缺失可选外部密钥不应导致 demo build 失败。
6. 建立 `/api/health`，只返回配置状态，不发送外部请求和密钥。
7. 添加最小 smoke test 和 Playwright 配置。
8. 保留规格包，不把它移动进 `web/`。

验收：`pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全部通过。
