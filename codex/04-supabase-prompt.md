# Phase 4：Supabase 数据层

执行实施计划 Task 4。

1. 将根目录 `supabase/migrations/` 接入 Supabase CLI 目录，保持迁移内容可追踪。
2. 创建 browser/server/admin 三个 client：
   - browser 仅 publishable key
   - server 使用 cookie session
   - admin 仅 server-only module 使用 service role
3. 实现领域 repository：business、user、conversation、knowledge、ai-ops。
4. 页面从 mock repository 切换为可配置 repository：
   - 配置完整时 Supabase
   - demo mode 或网络失败时显式 fallback
5. 数据库行转 domain contracts，禁止 UI 依赖 snake_case 行结构。
6. 为 repository 编写 fake-client 单测。
7. 增加 seed 数据检查页或脚本。

不要在浏览器直接写 AI Ops 或知识发布表。
