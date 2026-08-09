# Phase 6：深入 RAG Knowledge Service

执行实施计划 Task 8。读取 `docs/06-rag-knowledge-system.md`。

实现独立接口：

```ts
interface KnowledgeService {
  search(input: KnowledgeSearchInput, signal?: AbortSignal): Promise<KnowledgeSearchResult>;
  indexVersion(versionId: string): Promise<IndexResult>;
}
```

检索步骤：

1. 查询改写与 domain/category/city 元数据提取。
2. `text-embedding-v4` 生成 1024 维 query embedding。
3. 调用 `hybrid_search_kb`，向量权重 0.65、文本权重 0.35。
4. 可配置启用 `qwen3-rerank`，失败时使用融合排序降级。
5. 只返回 published、当前有效版本。
6. 最终 5 条片段，去重同一文章的相邻重复。
7. 低于阈值时 `lowConfidence=true`，不得强答。
8. 引用必须包含 article/version/chunk/title/effective date/excerpt/score。

索引步骤：Markdown 规范化、按标题与语义切片、适度 overlap、批量 embedding、幂等 upsert、失败状态可重试。

测试覆盖：版本过滤、metadata、混合排序、rerank fallback、引用完整、低置信和冲突知识。
