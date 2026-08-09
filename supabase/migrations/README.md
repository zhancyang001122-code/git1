# Supabase migrations

按文件名顺序在 Supabase CLI 或 SQL Editor 中执行。推荐：

```bash
supabase init
supabase link --project-ref <project-ref>
supabase db push
```

## 约定

- `public` 中保存演示业务、用户、知识和 AI 运营表；代码层必须通过领域 service 隔离。
- 房源、团购、商品、帖子都带 `is_demo=true`。
- `kb_articles` 是知识身份，`kb_article_versions` 是权威版本，`kb_chunks` 是可重建索引。
- 生产环境把写操作放到服务端，并使用 Auth/RLS。service role 仅存在于服务端。
- `kb_chunks.embedding` 固定 1024 维，与 `text-embedding-v4` 环境配置一致。切换维度需要新迁移和全量重建索引。
- 种子图片使用远程占位 URL，Codex 可在后续替换为本地合法素材。

迁移完成后，应用侧运行向量化脚本，把 `embedding_status='pending'` 的 chunk 生成 embedding。
