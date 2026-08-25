import { describe, expect, it, vi } from "vitest";

import { createInMemoryKnowledgeOpsRepository } from "@/features/knowledge-ops/repository";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";

const candidateId = "64000000-0000-4000-8000-000000000001";
const draft = {
  title: "Deposit evidence checklist",
  answerMarkdown: "Verify the contract, inspection report and receipts.",
  changeSummary: "Add evidence requirements",
  sourceReference: "PORTFOLIO-HOUSING-001",
  owner: "Knowledge operations owner",
  domain: "housing" as const,
  category: "deposit",
  effectiveFrom: "2026-08-12",
};

function liveEnvironment(qwenKey?: string) {
  return {
    NEXT_PUBLIC_DEMO_MODE: "false",
    DEMO_ADMIN_TOKEN: "a".repeat(32),
    DASHSCOPE_API_KEY: qwenKey,
  };
}

function approvedRepository() {
  return createInMemoryKnowledgeOpsRepository([
    {
      id: candidateId,
      sourceType: "human_correction",
      sourceSessionId: null,
      sourceMessageId: null,
      normalizedQuestion: "What evidence is needed?",
      domain: "housing",
      reason: "missing_source",
      evidence: [],
      status: "approved",
      occurrenceCount: 1,
      draft,
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
    },
  ]);
}

describe("createKnowledgeOpsRuntime", () => {
  it("keeps persistent candidate management available without Qwen", async () => {
    const runtime = await createKnowledgeOpsRuntime({
      environment: liveEnvironment(),
      repository: approvedRepository(),
    });

    await expect(runtime.service.listCandidates()).resolves.toHaveLength(1);
    await expect(
      runtime.service.publish({ candidateId }),
    ).rejects.toMatchObject({
      code: "KNOWLEDGE_INDEXING_NOT_CONFIGURED",
      status: 503,
    });
    await expect(
      runtime.service.getCandidate(candidateId),
    ).resolves.toMatchObject({ status: "approved" });
  });

  it("uses the configured knowledge service for live indexing and evaluation", async () => {
    const indexVersion = vi.fn(async (versionId: string) => ({
      versionId,
      totalChunks: 1,
      indexedChunks: 1,
      skippedChunks: 0,
      status: "ready" as const,
    }));
    const chunkId = "63000000-0000-4000-8000-000000000001";
    const search = vi.fn(async () => ({
      chunks: [
        {
          chunkId,
          articleId: "61000000-0000-4000-8000-000000000001",
          versionId: "62000000-0000-4000-8000-000000000001",
          chunkIndex: 0,
          title: draft.title,
          versionLabel: "v1",
          effectiveFrom: draft.effectiveFrom,
          effectiveUntil: null,
          articleStatus: "published" as const,
          versionStatus: "published" as const,
          content: draft.answerMarkdown,
          metadata: {},
          vectorScore: 1,
          textScore: 1,
          combinedScore: 1,
          score: 1,
          isDemo: false,
        },
      ],
      citations: [
        {
          articleId: "61000000-0000-4000-8000-000000000001",
          versionId: "62000000-0000-4000-8000-000000000001",
          chunkId,
          title: draft.title,
          versionLabel: "v1",
          effectiveFrom: draft.effectiveFrom,
          excerpt: draft.answerMarkdown,
          score: 1,
        },
      ],
      lowConfidence: false,
      conflict: false,
      queryPlan: { rewrittenQuery: "What evidence is needed?" },
      warnings: [],
      rankingStrategy: "hybrid_rerank" as const,
      isDemo: false,
    }));
    const runtime = await createKnowledgeOpsRuntime({
      environment: liveEnvironment("qwen-secret"),
      repository: approvedRepository(),
      knowledgeService: { indexVersion, search },
    });

    expect(runtime).toMatchObject({ mode: "live", adminToken: "a".repeat(32) });
    const result = await runtime.service.publish({ candidateId });
    expect(indexVersion).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      indexStatus: "ready",
      evaluationStatus: "passed",
      searchable: true,
    });
  });
});
