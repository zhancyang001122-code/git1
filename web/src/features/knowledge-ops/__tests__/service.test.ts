import { describe, expect, it, vi } from "vitest";

import { createInMemoryKnowledgeOpsRepository } from "@/features/knowledge-ops/repository";
import { createKnowledgeOpsService } from "@/features/knowledge-ops/service";

const approvedDraft = {
  title: "过期团购券退款说明",
  answerMarkdown: "模拟规则：团购券过期两天后不承诺自动退款，可提交人工复核。",
  changeSummary: "补充过期券处理边界",
  sourceReference: "DEMO-EVIDENCE-EXPIRED-01",
  owner: "知识运营演示负责人",
  domain: "group_buy" as const,
  category: "refund",
  effectiveFrom: "2026-08-11",
};

async function approvedService(
  options: {
    indexFails?: boolean;
    evalPasses?: boolean;
    evalThrows?: boolean;
  } = {},
) {
  const order: string[] = [];
  const repository = createInMemoryKnowledgeOpsRepository();
  const service = createKnowledgeOpsService({
    repository,
    indexer: {
      async indexVersion(versionId) {
        order.push("index");
        if (options.indexFails) throw new Error("embedding unavailable");
        return {
          versionId,
          totalChunks: 1,
          indexedChunks: 1,
          skippedChunks: 0,
          status: "ready" as const,
        };
      },
    },
    evaluator: {
      async run() {
        order.push("evaluate");
        if (options.evalThrows) throw new Error("evaluation unavailable");
        return {
          runId: "68000000-0000-4000-8000-000000000001",
          passed: options.evalPasses ?? true,
          score: options.evalPasses === false ? 0.75 : 1,
          total: 4,
          passedCount: options.evalPasses === false ? 3 : 4,
        };
      },
    },
    hooks: {
      onPreparePublication: () => order.push("prepare"),
      onPublishVersion: () => order.push("publish"),
    },
    isDemo: true,
  });
  const first = await service.createCandidate({
    sourceType: "no_result",
    sessionId: "71000000-0000-4000-8000-000000000001",
    messageId: "72000000-0000-4000-8000-000000000001",
    question: "团购券过期两天可以退款吗",
    domain: "group_buy",
    reason: "no_effective_evidence",
    evidence: [],
  });
  await service.draftCandidate(first.candidateId, approvedDraft);
  await service.review({
    candidateId: first.candidateId,
    decision: "approve",
    notes: "证据编号已由演示审核员核对",
    draft: approvedDraft,
  });
  return { first, order, repository, service };
}

describe("KnowledgeOpsService", () => {
  it("deduplicates normalized open candidates", async () => {
    const repository = createInMemoryKnowledgeOpsRepository();
    const service = createKnowledgeOpsService({
      repository,
      indexer: { indexVersion: vi.fn() },
      evaluator: { run: vi.fn() },
      isDemo: true,
    });
    const input = {
      sourceType: "no_result" as const,
      sessionId: "71000000-0000-4000-8000-000000000001",
      messageId: "72000000-0000-4000-8000-000000000001",
      question: "团购券过期两天可以退款吗",
      domain: "group_buy" as const,
      reason: "no_effective_evidence",
      evidence: [],
    };

    const first = await service.createCandidate(input);
    const second = await service.createCandidate({
      ...input,
      question: "  团购券过期两天可以退款吗  ",
    });

    expect(second.candidateId).toBe(first.candidateId);
    expect(second.deduplicated).toBe(true);
    expect(
      (await service.getCandidate(first.candidateId)).occurrenceCount,
    ).toBe(2);
  });

  it("publishes, indexes and evaluates in order", async () => {
    const { first, order, service } = await approvedService();

    const result = await service.publish({ candidateId: first.candidateId });

    expect(order).toEqual(["prepare", "publish", "index", "evaluate"]);
    expect(result).toMatchObject({
      candidateId: first.candidateId,
      publicationStatus: "published",
      indexStatus: "ready",
      evaluationStatus: "passed",
      searchable: true,
      isDemo: true,
    });
  });

  it("surfaces indexing failure and never claims the version is searchable", async () => {
    const { first, order, service } = await approvedService({
      indexFails: true,
    });

    const result = await service.publish({ candidateId: first.candidateId });

    expect(order).toEqual(["prepare", "publish", "index"]);
    expect(result).toMatchObject({
      publicationStatus: "published",
      indexStatus: "failed",
      evaluationStatus: "not_run",
      searchable: false,
    });
    expect(result.warnings).toContain("INDEXING_FAILED");
  });

  it("keeps a published version visible with a rollback option when evaluation fails", async () => {
    const { first, service } = await approvedService({ evalPasses: false });

    const result = await service.publish({ candidateId: first.candidateId });

    expect(result).toMatchObject({
      publicationStatus: "published",
      indexStatus: "ready",
      evaluationStatus: "failed",
      searchable: true,
      rollbackAvailable: false,
    });
    expect(result.warnings).toContain("EVALUATION_FAILED");
    expect(result.warnings).toContain("NO_ROLLBACK_TARGET");
  });

  it("turns an evaluation outage into a visible risk state", async () => {
    const { first, service } = await approvedService({ evalThrows: true });

    const result = await service.publish({ candidateId: first.candidateId });

    expect(result).toMatchObject({
      publicationStatus: "published",
      indexStatus: "ready",
      evaluationStatus: "failed",
      searchable: true,
      rollbackAvailable: false,
    });
    expect(result.warnings).toEqual([
      "EVALUATION_FAILED",
      "NO_ROLLBACK_TARGET",
    ]);
  });

  it("rolls a failed replacement back to the previous published version", async () => {
    const repository = createInMemoryKnowledgeOpsRepository();
    let evaluationPasses = true;
    const service = createKnowledgeOpsService({
      repository,
      indexer: {
        async indexVersion(versionId) {
          return {
            versionId,
            totalChunks: 1,
            indexedChunks: 1,
            skippedChunks: 0,
            status: "ready" as const,
          };
        },
      },
      evaluator: {
        async run() {
          return {
            runId: crypto.randomUUID(),
            total: 1,
            passedCount: evaluationPasses ? 1 : 0,
            score: evaluationPasses ? 1 : 0,
            passed: evaluationPasses,
          };
        },
      },
      isDemo: true,
    });

    async function approve(question: string) {
      const created = await service.createCandidate({
        sourceType: "human_correction",
        sessionId: null,
        messageId: null,
        question,
        domain: "group_buy",
        reason: "policy_update",
        evidence: [],
      });
      const draft = { ...approvedDraft, title: question };
      await service.review({
        candidateId: created.candidateId,
        decision: "approve",
        notes: "来源已核对",
        draft,
      });
      return created.candidateId;
    }

    const firstId = await approve("第一版退款规则");
    const first = await service.publish({ candidateId: firstId });
    evaluationPasses = false;
    const secondId = await approve("第二版退款规则");
    const second = await service.publish({ candidateId: secondId });

    expect(second.rollbackAvailable).toBe(true);
    const rollback = await service.rollback({ candidateId: secondId });
    expect(rollback).toMatchObject({
      rolledBack: true,
      articleId: first.articleId,
      versionId: first.versionId,
      isDemo: true,
    });
  });
});
