import { describe, expect, it, vi } from "vitest";

import { DefaultKnowledgeService } from "@/features/knowledge/service";
import type {
  EmbeddingProvider,
  HybridKnowledgeHit,
  KnowledgeRepository,
  KnowledgeReranker,
  KnowledgeVersionForIndex,
} from "@/features/knowledge/types";

const embedding: EmbeddingProvider = {
  embed: vi.fn(async (texts) => texts.map(() => Array(1024).fill(0.01))),
};

function hit(
  id: string,
  overrides: Partial<HybridKnowledgeHit> = {},
): HybridKnowledgeHit {
  return {
    chunkId: id,
    articleId: `61000000-0000-0000-0000-${id.slice(-12)}`,
    versionId: `62000000-0000-0000-0000-${id.slice(-12)}`,
    chunkIndex: 0,
    title: "团购券退款规则",
    versionLabel: "v1.0",
    effectiveFrom: "2026-08-01",
    effectiveUntil: null,
    articleStatus: "published",
    versionStatus: "published",
    content: "未使用且有效期内的可退团购券可以申请退款。",
    metadata: { domain: "group_buy", category: "refund", city: "杭州" },
    vectorScore: 0.8,
    textScore: 0.7,
    combinedScore: 0.765,
    isDemo: false,
    ...overrides,
  };
}

function repository(hits: HybridKnowledgeHit[]): KnowledgeRepository {
  return {
    hybridSearch: vi.fn(async () => hits),
    getVersionForIndex: vi.fn(async () => null),
    listChunksForVersion: vi.fn(async () => []),
    upsertChunks: vi.fn(async () => undefined),
    deleteChunksNotIn: vi.fn(async () => undefined),
    markChunksFailed: vi.fn(async () => undefined),
  };
}

describe("DefaultKnowledgeService search", () => {
  it("rechecks publication and effective dates at the application boundary", async () => {
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001"),
        hit("63000000-0000-0000-0000-000000000002", {
          versionStatus: "draft",
        }),
        hit("63000000-0000-0000-0000-000000000003", {
          effectiveUntil: "2026-07-31",
        }),
      ]),
      embedding,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "团购券能退款吗",
      domain: null,
      category: null,
      city: "杭州",
      topK: 5,
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.citations).toHaveLength(1);
    expect(result.lowConfidence).toBe(false);
  });

  it("falls back to hybrid order when reranking fails", async () => {
    const reranker: KnowledgeReranker = {
      rerank: vi.fn(async () => {
        throw new Error("upstream unavailable");
      }),
    };
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001", { combinedScore: 0.8 }),
        hit("63000000-0000-0000-0000-000000000002", { combinedScore: 0.6 }),
      ]),
      embedding,
      reranker,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "退款条件",
      domain: null,
      category: null,
      city: null,
      topK: 5,
    });

    expect(result.chunks.map((item) => item.chunkId)).toEqual([
      "63000000-0000-0000-0000-000000000001",
      "63000000-0000-0000-0000-000000000002",
    ]);
    expect(result.warnings).toContain("RERANK_FALLBACK");
  });

  it("flags low confidence and conflicting normalized policy values", async () => {
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001", {
          vectorScore: 0.4,
          combinedScore: 0.4,
          metadata: { policyKey: "refund_allowed", policyValue: "yes" },
        }),
        hit("63000000-0000-0000-0000-000000000002", {
          vectorScore: 0.39,
          combinedScore: 0.39,
          metadata: { policyKey: "refund_allowed", policyValue: "no" },
        }),
      ]),
      embedding,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "一定能退款吗",
      domain: null,
      category: null,
      city: null,
      topK: 5,
    });

    expect(result.lowConfidence).toBe(true);
    expect(result.conflict).toBe(true);
  });

  it("uses semantic vector confidence when Chinese trigram text score is weak", async () => {
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001", {
          vectorScore: 0.66,
          textScore: 0.01,
          combinedScore: 0.4325,
        }),
      ]),
      embedding,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "小智是原生微信小程序吗",
      domain: "platform",
      category: "portfolio_capabilities",
      city: null,
      topK: 5,
    });

    expect(result.lowConfidence).toBe(false);
  });

  it("excludes individually low-confidence chunks from passages and citations", async () => {
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001", {
          title: "小智作品集：历史房源数据边界",
          vectorScore: 0.7,
          combinedScore: 0.5,
          isDemo: false,
        }),
        hit("63000000-0000-0000-0000-000000000002", {
          title: "房源宠物入住规则",
          vectorScore: 0.34,
          combinedScore: 0.3,
          isDemo: true,
        }),
      ]),
      embedding,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "房源数据是哪一期",
      domain: "housing",
      category: null,
      city: null,
      topK: 5,
    });

    expect(result.chunks.map((item) => item.title)).toEqual([
      "小智作品集：历史房源数据边界",
    ]);
    expect(result.citations.map((item) => item.title)).toEqual([
      "小智作品集：历史房源数据边界",
    ]);
    expect(result.isDemo).toBe(false);
  });

  it("keeps adjacent chunks when their content is different", async () => {
    const articleId = "61000000-0000-0000-0000-000000000001";
    const versionId = "62000000-0000-0000-0000-000000000001";
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001", {
          chunkIndex: 0,
          articleId,
          versionId,
          content: "产品形态与真实能力边界。",
          metadata: { contentHash: "content-a" },
        }),
        hit("63000000-0000-0000-0000-000000000002", {
          chunkIndex: 1,
          articleId,
          versionId,
          content: "常见问题与明确回答。",
          vectorScore: 0.3,
          combinedScore: 0.3,
          metadata: { contentHash: "content-b" },
        }),
      ]),
      embedding,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "产品能力",
      domain: "platform",
      category: "portfolio_capabilities",
      city: null,
      topK: 5,
    });

    expect(result.chunks).toHaveLength(2);
  });

  it("deduplicates identical chunk content by its stored hash", async () => {
    const versionId = "62000000-0000-0000-0000-000000000001";
    const service = new DefaultKnowledgeService({
      repository: repository([
        hit("63000000-0000-0000-0000-000000000001", {
          chunkIndex: 0,
          versionId,
          metadata: { contentHash: "same-content" },
        }),
        hit("63000000-0000-0000-0000-000000000002", {
          chunkIndex: 4,
          versionId,
          metadata: { contentHash: "same-content" },
        }),
      ]),
      embedding,
      now: () => new Date("2026-08-11T00:00:00Z"),
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.search({
      query: "退款规则",
      domain: "group_buy",
      category: "refund",
      city: null,
      topK: 5,
    });

    expect(result.chunks).toHaveLength(1);
  });
});

const publishedVersion: KnowledgeVersionForIndex = {
  articleId: "61000000-0000-0000-0000-000000000001",
  versionId: "62000000-0000-0000-0000-000000000001",
  title: "团购券退款规则",
  versionLabel: "v1.0",
  contentMarkdown:
    "# 退款范围\n\n未使用且在有效期内的团购券可以申请退款。退款到账时间以支付渠道为准。",
  domain: "group_buy",
  category: "refund",
  city: "杭州",
  isDemo: false,
  status: "published",
};

describe("DefaultKnowledgeService indexVersion", () => {
  it("skips unchanged ready chunks so retries are idempotent", async () => {
    const repo = repository([]);
    vi.mocked(repo.getVersionForIndex).mockResolvedValue(publishedVersion);
    const firstService = new DefaultKnowledgeService({
      repository: repo,
      embedding,
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });
    const first = await firstService.indexVersion(publishedVersion.versionId);
    const indexed = vi.mocked(repo.upsertChunks).mock.calls[0]![0];
    vi.mocked(repo.listChunksForVersion).mockResolvedValue(
      indexed.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        contentHash: chunk.contentHash,
        embeddingStatus: "ready",
      })),
    );

    const second = await firstService.indexVersion(publishedVersion.versionId);

    expect(first.indexedChunks).toBeGreaterThan(0);
    expect(second).toMatchObject({
      indexedChunks: 0,
      skippedChunks: first.totalChunks,
    });
    expect(repo.upsertChunks).toHaveBeenCalledTimes(1);
  });

  it("preserves simulated provenance when indexing demo knowledge", async () => {
    const repo = repository([]);
    vi.mocked(repo.getVersionForIndex).mockResolvedValue({
      ...publishedVersion,
      isDemo: true,
    });
    const service = new DefaultKnowledgeService({
      repository: repo,
      embedding,
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    await service.indexVersion(publishedVersion.versionId);

    const indexed = vi.mocked(repo.upsertChunks).mock.calls[0]![0];
    expect(indexed).not.toHaveLength(0);
    expect(indexed.every((chunk) => chunk.metadata.isDemo === true)).toBe(true);
  });

  it("marks pending chunks failed when embedding fails", async () => {
    const repo = repository([]);
    vi.mocked(repo.getVersionForIndex).mockResolvedValue(publishedVersion);
    const failingEmbedding: EmbeddingProvider = {
      embed: vi.fn(async () => {
        throw new Error("upstream unavailable");
      }),
    };
    const service = new DefaultKnowledgeService({
      repository: repo,
      embedding: failingEmbedding,
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    await expect(
      service.indexVersion(publishedVersion.versionId),
    ).rejects.toMatchObject({
      code: "KNOWLEDGE_INDEX_FAILED",
    });
    expect(repo.markChunksFailed).toHaveBeenCalledWith(
      publishedVersion.versionId,
      expect.arrayContaining([0]),
      undefined,
    );
  });

  it("deletes stale indexes after a shorter version is indexed", async () => {
    const repo = repository([]);
    vi.mocked(repo.getVersionForIndex).mockResolvedValue(publishedVersion);
    vi.mocked(repo.listChunksForVersion).mockResolvedValue([
      { chunkIndex: 0, contentHash: "old", embeddingStatus: "ready" },
      { chunkIndex: 1, contentHash: "stale", embeddingStatus: "ready" },
    ]);
    const service = new DefaultKnowledgeService({
      repository: repo,
      embedding,
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    const result = await service.indexVersion(publishedVersion.versionId);

    expect(result.totalChunks).toBe(1);
    expect(repo.deleteChunksNotIn).toHaveBeenCalledWith(
      publishedVersion.versionId,
      [0],
      undefined,
    );
  });

  it("rejects an incomplete embedding batch before writing chunks", async () => {
    const repo = repository([]);
    vi.mocked(repo.getVersionForIndex).mockResolvedValue(publishedVersion);
    const incompleteEmbedding: EmbeddingProvider = {
      embed: vi.fn(async () => []),
    };
    const service = new DefaultKnowledgeService({
      repository: repo,
      embedding: incompleteEmbedding,
      lowConfidenceThreshold: 0.45,
      vectorWeight: 0.65,
      textWeight: 0.35,
      recallCount: 12,
      finalCount: 5,
    });

    await expect(
      service.indexVersion(publishedVersion.versionId),
    ).rejects.toMatchObject({
      code: "EMBEDDING_INVALID_RESPONSE",
    });
    expect(repo.upsertChunks).not.toHaveBeenCalled();
  });
});
