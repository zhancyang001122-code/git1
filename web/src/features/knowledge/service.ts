import { citationFromHit } from "@/features/knowledge/citations";
import { chunkKnowledgeVersion } from "@/features/knowledge/chunker";
import { planKnowledgeQuery } from "@/features/knowledge/query-planner";
import type {
  HybridKnowledgeHit,
  IndexResult,
  KnowledgeHit,
  KnowledgeRepository,
  KnowledgeReranker,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  KnowledgeService,
  EmbeddingProvider,
} from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";

interface DefaultKnowledgeServiceOptions {
  repository: KnowledgeRepository;
  embedding: EmbeddingProvider;
  reranker?: KnowledgeReranker;
  embeddingModel?: string;
  now?: () => Date;
  lowConfidenceThreshold: number;
  vectorWeight: number;
  textWeight: number;
  recallCount: number;
  finalCount: number;
}

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateOnly(date: Date): string {
  const parts = businessDateFormatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function isEligible(hit: HybridKnowledgeHit, today: string): boolean {
  return (
    hit.articleStatus === "published" &&
    hit.versionStatus === "published" &&
    (hit.effectiveFrom === null || hit.effectiveFrom <= today) &&
    (hit.effectiveUntil === null || hit.effectiveUntil >= today)
  );
}

function removeDuplicateContent(hits: readonly KnowledgeHit[]): KnowledgeHit[] {
  const accepted: KnowledgeHit[] = [];
  const contentKeys = new Set<string>();
  for (const hit of hits) {
    const contentHash = hit.metadata.contentHash;
    const key =
      typeof contentHash === "string" && contentHash.length > 0
        ? `${hit.versionId}:${contentHash}`
        : `${hit.versionId}:${hit.content.normalize("NFKC").trim()}`;
    if (contentKeys.has(key)) continue;
    contentKeys.add(key);
    accepted.push(hit);
  }
  return accepted;
}

function confidenceScore(hit: KnowledgeHit): number {
  return Math.max(hit.score, hit.vectorScore);
}

const SECONDARY_ARTICLE_CONFIDENCE_RATIO = 0.86;

function relevantChunks(
  candidates: readonly KnowledgeHit[],
  absoluteThreshold: number,
): KnowledgeHit[] {
  const topConfidence = candidates.reduce(
    (highest, hit) => Math.max(highest, confidenceScore(hit)),
    0,
  );
  const articleThreshold = Math.max(
    absoluteThreshold,
    topConfidence * SECONDARY_ARTICLE_CONFIDENCE_RATIO,
  );
  const acceptedArticles = new Set(
    candidates
      .filter((hit) => confidenceScore(hit) >= articleThreshold)
      .map((hit) => hit.articleId),
  );
  return candidates.filter((hit) => acceptedArticles.has(hit.articleId));
}

function hasConflict(hits: readonly KnowledgeHit[]): boolean {
  const values = new Map<string, Set<string>>();
  for (const hit of hits) {
    const key = hit.metadata.policyKey;
    const value = hit.metadata.policyValue;
    if (typeof key !== "string" || typeof value !== "string") continue;
    const current = values.get(key) ?? new Set<string>();
    current.add(value.trim().toLowerCase());
    values.set(key, current);
  }
  return [...values.values()].some((items) => items.size > 1);
}

export class DefaultKnowledgeService implements KnowledgeService {
  private readonly repository: KnowledgeRepository;
  private readonly embedding: EmbeddingProvider;
  private readonly reranker?: KnowledgeReranker;
  private readonly embeddingModel: string;
  private readonly now: () => Date;
  private readonly lowConfidenceThreshold: number;
  private readonly vectorWeight: number;
  private readonly textWeight: number;
  private readonly recallCount: number;
  private readonly finalCount: number;

  constructor(options: DefaultKnowledgeServiceOptions) {
    this.repository = options.repository;
    this.embedding = options.embedding;
    this.reranker = options.reranker;
    this.embeddingModel = options.embeddingModel ?? "text-embedding-v4";
    this.now = options.now ?? (() => new Date());
    this.lowConfidenceThreshold = options.lowConfidenceThreshold;
    this.vectorWeight = options.vectorWeight;
    this.textWeight = options.textWeight;
    this.recallCount = options.recallCount;
    this.finalCount = options.finalCount;
  }

  async search(
    input: KnowledgeSearchInput,
    signal?: AbortSignal,
  ): Promise<KnowledgeSearchResult> {
    const queryPlan = planKnowledgeQuery(input);
    const [queryEmbedding] = await this.embedding.embed(
      [queryPlan.rewrittenQuery],
      signal,
    );
    if (!queryEmbedding) {
      throw new AppError({
        code: "EMBEDDING_INVALID_RESPONSE",
        message: "查询向量缺失",
        retryable: true,
      });
    }
    const recalled = await this.repository.hybridSearch(
      {
        queryText: queryPlan.rewrittenQuery,
        queryEmbedding,
        ...(queryPlan.domain && { domain: queryPlan.domain }),
        ...(queryPlan.category && { category: queryPlan.category }),
        ...(queryPlan.city && { city: queryPlan.city }),
        matchCount: this.recallCount,
        vectorWeight: this.vectorWeight,
        textWeight: this.textWeight,
      },
      signal,
    );
    const eligible = recalled
      .filter((hit) => isEligible(hit, dateOnly(this.now())))
      .sort((left, right) => right.combinedScore - left.combinedScore);
    let ranked: KnowledgeHit[] = eligible.map((hit) => ({
      ...hit,
      score: hit.combinedScore,
    }));
    const warnings: string[] = [];
    if (this.reranker && ranked.length > 0) {
      try {
        const reranked = await this.reranker.rerank(
          queryPlan.rewrittenQuery,
          ranked.map((hit) => hit.content),
          signal,
        );
        ranked = reranked.map((item) => ({
          ...ranked[item.index]!,
          score: item.score,
        }));
      } catch (error) {
        void error;
        warnings.push("RERANK_FALLBACK");
      }
    }
    const finalCount = Math.min(input.topK, this.finalCount);
    const candidates = removeDuplicateContent(ranked).slice(0, finalCount);
    const chunks = relevantChunks(candidates, this.lowConfidenceThreshold);
    return {
      chunks,
      citations: chunks.map(citationFromHit),
      lowConfidence:
        chunks.length === 0 ||
        confidenceScore(chunks[0]!) < this.lowConfidenceThreshold,
      conflict: hasConflict(candidates),
      queryPlan,
      warnings,
      isDemo: chunks.length > 0 && chunks.every((chunk) => chunk.isDemo),
    };
  }

  async indexVersion(
    versionId: string,
    signal?: AbortSignal,
  ): Promise<IndexResult> {
    const version = await this.repository.getVersionForIndex(versionId, signal);
    if (!version) {
      throw new AppError({
        code: "KNOWLEDGE_VERSION_NOT_FOUND",
        message: "没有找到知识版本",
        status: 404,
      });
    }
    if (version.status !== "published") {
      throw new AppError({
        code: "KNOWLEDGE_VERSION_NOT_PUBLISHED",
        message: "只有已发布版本可以建立检索索引",
        status: 409,
      });
    }
    const drafts = chunkKnowledgeVersion({
      articleId: version.articleId,
      versionId: version.versionId,
      title: version.title,
      domain: version.domain,
      category: version.category,
      city: version.city,
      isDemo: version.isDemo,
      materialKind:
        version.materialKind ??
        (version.isDemo ? "demo" : "external_authorized"),
      contentMarkdown: version.contentMarkdown,
    });
    const existing = await this.repository.listChunksForVersion(
      versionId,
      signal,
    );
    const existingByIndex = new Map(
      existing.map((chunk) => [chunk.chunkIndex, chunk]),
    );
    const pending = drafts.filter((draft) => {
      const stored = existingByIndex.get(draft.chunkIndex);
      return (
        stored?.embeddingStatus !== "ready" ||
        stored.contentHash !== draft.contentHash
      );
    });
    if (pending.length === 0) {
      await this.repository.deleteChunksNotIn(
        versionId,
        drafts.map((draft) => draft.chunkIndex),
        signal,
      );
      return {
        versionId,
        totalChunks: drafts.length,
        indexedChunks: 0,
        skippedChunks: drafts.length,
        status: "ready",
      };
    }
    try {
      const vectors = await this.embedding.embed(
        pending.map((chunk) => chunk.content),
        signal,
      );
      if (vectors.length !== pending.length) {
        throw new AppError({
          code: "EMBEDDING_INVALID_RESPONSE",
          message: "Embedding 返回数量与知识分块数量不一致",
          retryable: true,
        });
      }
      await this.repository.upsertChunks(
        pending.map((chunk, index) => ({
          ...chunk,
          embedding: vectors[index]!,
          embeddingModel: this.embeddingModel,
        })),
        signal,
      );
      await this.repository.deleteChunksNotIn(
        versionId,
        drafts.map((draft) => draft.chunkIndex),
        signal,
      );
    } catch (error) {
      signal?.throwIfAborted();
      await this.repository.markChunksFailed(
        versionId,
        pending.map((chunk) => chunk.chunkIndex),
        signal,
      );
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "KNOWLEDGE_INDEX_FAILED",
        message: "知识索引失败，可安全重试",
        retryable: true,
        cause: error,
      });
    }
    return {
      versionId,
      totalChunks: drafts.length,
      indexedChunks: pending.length,
      skippedChunks: drafts.length - pending.length,
      status: "ready",
    };
  }
}
