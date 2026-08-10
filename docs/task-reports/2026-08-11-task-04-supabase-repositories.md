# Task 4 验证报告：Supabase Repositories 与 RLS

日期：2026-08-11

## 交付范围

- Browser、Server、Admin 三类 Supabase client，service role 只存在于服务端模块。
- Business、Memory、Conversation、AI Ops 四类 Repository。
- `supabase`、`demo`、`demo_fallback` 三种显式数据模式。
- 房源、团购、线上超市、购物车、周边和社区路由统一通过 Repository 读取。
- Supabase 失败默认暴露错误；只有 `SUPABASE_FALLBACK_TO_DEMO=true` 时才显式降级，并在 UI 显示提示。
- 真实 2024 历史房源允许 `is_demo=false`；团购和线上超市仍保持演示标识。

## 迁移修正

实际执行迁移时发现并修正了三个静态阅读不容易发现的问题：

1. `hybrid_search_kb` 的空 `search_path` 与 pgvector `<=>` 运算符冲突，现使用 `OPERATOR(extensions.<=>)` 显式限定 schema。
2. RLS Policy 不等于表权限，新增显式 `GRANT`，公开业务表只允许匿名/登录用户读取。
3. `ai_feedback` 使用 upsert，但原迁移缺少 UPDATE Policy，现增加 owner-only update。

商品库存新增数据库生成列 `available_stock = stock - reserved`。`inStockOnly` 在数据库中完成过滤，分页总数不再因应用层过滤而失真。

## 自动验证证据

### 静态迁移验证

命令：

```bash
cd web
pnpm db:check
```

结果：10 个迁移、26 张表全部具有 RLS；公开表只有显式 SELECT Grant；匿名写 Grant 不存在；服务端表没有客户端 Policy。

### 从空数据库执行

Docker Desktop 29.6.2 下使用一次性 `pgvector/pgvector:pg16` 容器，从空数据库顺序执行全部 10 个迁移，全部成功。数据库报告版本为 PostgreSQL 16.14。

### 数据库角色 RLS

命令：

```bash
cd web
pnpm db:verify-rls
```

结果：9 个边界场景通过，包括匿名业务只读、匿名写拒绝、AI 日志拒绝、本人偏好读写、跨用户隔离、反馈 upsert 和 service role 写入。

### PostgREST JWT / anon key

命令：

```bash
cd web
pnpm db:verify-http
```

结果：7 个 HTTP 场景通过。anon JWT 只读取到 11 条 `available=true` 的房源，不能写业务表或读取 AI 日志；authenticated JWT 只能读取本人偏好；service JWT 可以写服务端 AI 日志。

## 工具链限制

Supabase CLI 2.113.0 可以运行，但完整 `supabase start` 在拉取 `public.ecr.aws/supabase/postgres` 时多次超时，没有创建本地 Supabase PostgreSQL 容器。直接 `docker pull` 同样超时。因此本次使用 Supabase 兼容的 PostgreSQL + PostgREST 一次性验证环境完成真实 SQL、JWT 和 RLS 检查。

`supabase db lint` 能连接该一次性数据库，但基础镜像不包含 Supabase PostgreSQL 镜像内置的 `plpgsql_check`，所以该项没有形成通过证据。部署前仍需在正式或预发布 Supabase 项目执行迁移和远程 smoke test。

## 配置方式

- 默认作品集演示：`NEXT_PUBLIC_DEMO_MODE=true`
- Supabase 实时数据：配置 URL 与 publishable key，并设置 `NEXT_PUBLIC_DEMO_MODE=false`
- 显式业务读取降级：仅在需要时设置 `SUPABASE_FALLBACK_TO_DEMO=true`
- AI Ops service role 未配置时，只阻止管理写入，不影响公开业务读取

## Web 质量门禁

最终执行结果：

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：25 个测试文件、93 项测试全部通过
- `pnpm build`：通过，31 个页面完成生产构建
- `pnpm test:e2e`：Chromium 37 项全部通过
- `.next/static`：未发现 server key 名称或本地测试凭据
