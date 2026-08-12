import { describe, expect, it, vi } from "vitest";

import { createKnowledgeCandidatesHandlers } from "@/app/api/knowledge/candidates/route";
import { createInMemoryKnowledgeOpsRepository } from "@/features/knowledge-ops/repository";
import { createKnowledgeOpsService } from "@/features/knowledge-ops/service";

const token = "demo-admin-token-that-is-at-least-32-chars";

function runtime() {
  return {
    mode: "demo" as const,
    adminToken: token,
    service: createKnowledgeOpsService({
      repository: createInMemoryKnowledgeOpsRepository(),
      indexer: { indexVersion: vi.fn() },
      evaluator: { run: vi.fn() },
      isDemo: true,
    }),
  };
}

describe("/api/knowledge/candidates", () => {
  it("requires server-side admin authorization", async () => {
    const handlers = createKnowledgeCandidatesHandlers(async () => runtime());
    const response = await handlers.GET(
      new Request("http://localhost/api/knowledge/candidates"),
    );
    expect(response.status).toBe(401);
  });

  it("lists candidates and accepts a validated draft", async () => {
    const value = runtime();
    const created = await value.service.createCandidate({
      sourceType: "no_result",
      sessionId: null,
      messageId: null,
      question: "团购券过期两天可以退款吗",
      domain: "group_buy",
      reason: "no_result",
      evidence: [],
    });
    const handlers = createKnowledgeCandidatesHandlers(async () => value);
    const headers = { authorization: `Bearer ${token}` };

    const list = await handlers.GET(
      new Request("http://localhost/api/knowledge/candidates", { headers }),
    );
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      isDemo: true,
      items: [expect.objectContaining({ id: created.candidateId })],
    });

    const response = await handlers.POST(
      new Request("http://localhost/api/knowledge/candidates", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          candidateId: created.candidateId,
          draft: {
            title: "过期团购券退款说明",
            answerMarkdown:
              "模拟规则：过期两天不承诺自动退款，可提交人工复核。",
            changeSummary: "补充过期处理边界",
            sourceReference: "DEMO-EVIDENCE-EXPIRED-01",
            owner: "知识运营演示负责人",
            domain: "group_buy",
            category: "refund",
            effectiveFrom: "2026-08-11",
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      candidate: { status: "drafted" },
      isDemo: true,
    });
  });

  it("rejects an oversized candidate action before changing state", async () => {
    const value = runtime();
    const draftCandidate = vi.spyOn(value.service, "draftCandidate");
    const handlers = createKnowledgeCandidatesHandlers(async () => value);
    const response = await handlers.POST(
      new Request("http://localhost/api/knowledge/candidates", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ padding: "测".repeat(25_000) }),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_BODY_TOO_LARGE" },
    });
    expect(draftCandidate).not.toHaveBeenCalled();
  });
});
