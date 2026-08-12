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

  it("creates a manually entered material as a draft without publishing it", async () => {
    const value = runtime();
    const handlers = createKnowledgeCandidatesHandlers(async () => value);
    const response = await handlers.POST(
      new Request("http://localhost/api/knowledge/candidates", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create_draft",
          material: {
            question: "历史房源数据能否代表当前可租状态？",
            draft: {
              title: "历史房源数据使用边界",
              answerMarkdown:
                "房源数据来自 2024 年 11 月，只能用于历史筛选演示，不能据此判断当前是否可租。",
              changeSummary: "首次录入历史房源数据说明",
              sourceReference: "housing-data-readme.md",
              owner: "作品集作者",
              domain: "housing",
              category: "data_freshness",
              versionLabel: "v1.0",
              effectiveFrom: "2026-08-12",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      candidate: {
        sourceType: "human_correction",
        status: "drafted",
        draft: { versionLabel: "v1.0" },
      },
      deduplicated: false,
      isDemo: true,
    });
    const candidates = await value.service.listCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.status).toBe("drafted");
  });

  it("rejects invalid manual material before writing a candidate", async () => {
    const value = runtime();
    const createManualDraft = vi.spyOn(value.service, "createManualDraft");
    const handlers = createKnowledgeCandidatesHandlers(async () => value);
    const response = await handlers.POST(
      new Request("http://localhost/api/knowledge/candidates", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create_draft",
          material: {
            question: "历史房源数据能否代表当前可租状态？",
            draft: {
              title: "历史房源数据使用边界",
              answerMarkdown: "内容太短",
              changeSummary: "首次录入",
              sourceReference: "housing-data-readme.md",
              owner: "作品集作者",
              domain: "housing",
              category: "Data Freshness",
              versionLabel: "",
              effectiveFrom: "2026-08-12",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createManualDraft).not.toHaveBeenCalled();
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
