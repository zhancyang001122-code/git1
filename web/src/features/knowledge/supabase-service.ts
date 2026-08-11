import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { knowledgeDomains } from "@/features/knowledge/types";
import type {
  HybridKnowledgeHit,
  HybridSearchRequest,
  IndexedKnowledgeChunk,
  KnowledgeRepository,
  KnowledgeVersionForIndex,
  StoredKnowledgeChunk,
} from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";

const uuid = z.string().uuid();
const status = z.enum([
  "draft",
  "reviewing",
  "published",
  "archived",
  "rejected",
]);
const hitRowSchema = z.object({
  chunk_id: uuid,
  article_id: uuid,
  version_id: uuid,
  chunk_index: z.number().int().nonnegative(),
  title: z.string(),
  version_label: z.string(),
  effective_from: z.string().nullable(),
  effective_until: z.string().nullable(),
  article_status: status,
  version_status: status,
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  vector_score: z.number().finite(),
  text_score: z.number().finite(),
  combined_score: z.number().finite(),
  is_demo: z.boolean().default(false),
});
const versionRowSchema = z.object({
  id: uuid,
  article_id: uuid,
  version_label: z.string(),
  content_markdown: z.string(),
  status,
  is_demo: z.boolean().default(false),
  kb_articles: z.object({
    title: z.string(),
    city: z.string().nullable(),
    is_demo: z.boolean().default(false),
    kb_categories: z.object({
      domain: z.enum(knowledgeDomains),
      slug: z.string(),
    }),
  }),
});
const chunkRowSchema = z.object({
  chunk_index: z.number().int().nonnegative(),
  content_hash: z.string().nullable(),
  embedding_status: z.enum(["pending", "processing", "ready", "failed"]),
});

function repositoryError(code: string, message: string, cause: unknown): never {
  throw new AppError({ code, message, retryable: true, cause });
}

function mapHit(value: unknown): HybridKnowledgeHit {
  const row = hitRowSchema.parse(value);
  return {
    chunkId: row.chunk_id,
    articleId: row.article_id,
    versionId: row.version_id,
    chunkIndex: row.chunk_index,
    title: row.title,
    versionLabel: row.version_label,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    articleStatus: row.article_status,
    versionStatus: row.version_status,
    content: row.content,
    metadata: row.metadata,
    vectorScore: row.vector_score,
    textScore: row.text_score,
    combinedScore: row.combined_score,
    isDemo: row.is_demo,
  };
}

export function createSupabaseKnowledgeRepository(
  client: SupabaseClient,
): KnowledgeRepository {
  return {
    async hybridSearch(input: HybridSearchRequest, signal?: AbortSignal) {
      const query = client.rpc("hybrid_search_kb_v2", {
        p_query_text: input.queryText,
        p_query_embedding: [...input.queryEmbedding],
        p_domain: input.domain ?? null,
        p_category_slug: input.category ?? null,
        p_city: input.city ?? null,
        p_match_count: input.matchCount,
        p_vector_weight: input.vectorWeight,
        p_text_weight: input.textWeight,
      });
      if (signal) query.abortSignal(signal);
      const result = await query;
      if (result.error)
        repositoryError(
          "KNOWLEDGE_SEARCH_FAILED",
          "知识库检索暂时不可用",
          result.error,
        );
      try {
        return z
          .array(hitRowSchema)
          .parse(result.data ?? [])
          .map(mapHit);
      } catch (error) {
        repositoryError(
          "KNOWLEDGE_SEARCH_INVALID_RESPONSE",
          "知识库返回了无效数据",
          error,
        );
      }
    },

    async getVersionForIndex(
      versionId,
      signal?: AbortSignal,
    ): Promise<KnowledgeVersionForIndex | null> {
      const query = client
        .from("kb_article_versions")
        .select(
          "id,article_id,version_label,content_markdown,status,is_demo,kb_articles!inner(title,city,is_demo,kb_categories!inner(domain,slug))",
        )
        .eq("id", versionId);
      if (signal) query.abortSignal(signal);
      const result = await query.maybeSingle();
      if (result.error)
        repositoryError(
          "KNOWLEDGE_VERSION_QUERY_FAILED",
          "知识版本查询失败",
          result.error,
        );
      if (!result.data) return null;
      let row: z.infer<typeof versionRowSchema>;
      try {
        row = versionRowSchema.parse(result.data);
      } catch (error) {
        repositoryError(
          "KNOWLEDGE_VERSION_INVALID_RESPONSE",
          "知识版本数据格式无效",
          error,
        );
      }
      return {
        articleId: row.article_id,
        versionId: row.id,
        title: row.kb_articles.title,
        versionLabel: row.version_label,
        contentMarkdown: row.content_markdown,
        domain: row.kb_articles.kb_categories.domain,
        category: row.kb_articles.kb_categories.slug,
        city: row.kb_articles.city,
        isDemo: row.is_demo || row.kb_articles.is_demo,
        status: row.status,
      };
    },

    async listChunksForVersion(
      versionId,
      signal?: AbortSignal,
    ): Promise<StoredKnowledgeChunk[]> {
      const query = client
        .from("kb_chunks")
        .select("chunk_index,content_hash,embedding_status")
        .eq("version_id", versionId)
        .order("chunk_index", { ascending: true });
      if (signal) query.abortSignal(signal);
      const result = await query;
      if (result.error)
        repositoryError(
          "KNOWLEDGE_CHUNKS_QUERY_FAILED",
          "知识分块查询失败",
          result.error,
        );
      try {
        return z
          .array(chunkRowSchema)
          .parse(result.data ?? [])
          .map((row) => ({
            chunkIndex: row.chunk_index,
            contentHash: row.content_hash,
            embeddingStatus: row.embedding_status,
          }));
      } catch (error) {
        repositoryError(
          "KNOWLEDGE_CHUNKS_INVALID_RESPONSE",
          "知识分块数据格式无效",
          error,
        );
      }
    },

    async upsertChunks(
      chunks: readonly IndexedKnowledgeChunk[],
      signal?: AbortSignal,
    ) {
      if (chunks.length === 0) return;
      const query = client.from("kb_chunks").upsert(
        chunks.map((chunk) => ({
          article_id: chunk.articleId,
          version_id: chunk.versionId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          content_hash: chunk.contentHash,
          metadata: chunk.metadata,
          embedding: [...chunk.embedding],
          embedding_status: "ready",
          embedding_model: chunk.embeddingModel,
          embedded_at: new Date().toISOString(),
        })),
        { onConflict: "version_id,chunk_index" },
      );
      if (signal) query.abortSignal(signal);
      const result = await query;
      if (result.error)
        repositoryError(
          "KNOWLEDGE_CHUNKS_UPSERT_FAILED",
          "知识索引写入失败",
          result.error,
        );
    },

    async deleteChunksNotIn(
      versionId,
      retainedChunkIndexes,
      signal?: AbortSignal,
    ) {
      let query = client.from("kb_chunks").delete().eq("version_id", versionId);
      if (retainedChunkIndexes.length > 0) {
        query = query.not(
          "chunk_index",
          "in",
          `(${retainedChunkIndexes.join(",")})`,
        );
      }
      if (signal) query.abortSignal(signal);
      const result = await query;
      if (result.error)
        repositoryError(
          "KNOWLEDGE_STALE_CHUNKS_DELETE_FAILED",
          "旧知识分块清理失败",
          result.error,
        );
    },

    async markChunksFailed(versionId, chunkIndexes, signal?: AbortSignal) {
      if (chunkIndexes.length === 0) return;
      const query = client
        .from("kb_chunks")
        .update({ embedding_status: "failed" })
        .eq("version_id", versionId)
        .in("chunk_index", [...chunkIndexes]);
      if (signal) query.abortSignal(signal);
      const result = await query;
      if (result.error)
        repositoryError(
          "KNOWLEDGE_CHUNKS_MARK_FAILED",
          "知识索引失败状态写入失败",
          result.error,
        );
    },
  };
}
