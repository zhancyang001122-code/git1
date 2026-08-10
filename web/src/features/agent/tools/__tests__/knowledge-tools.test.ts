import { describe, expect, it, vi } from "vitest";

import { createTaskSixToolRegistry } from "@/features/agent/tools/registry";
import { FakeKnowledgeService } from "@/features/knowledge/fake-service";

import { createToolTestContext } from "./helpers";

describe("knowledge tools", () => {
  it("registers search_knowledge with a strict validated contract", () => {
    const definition = createTaskSixToolRegistry()
      .providerDefinitions()
      .find((item) => item.name === "search_knowledge");

    expect(definition).toMatchObject({
      name: "search_knowledge",
      strict: true,
      parameters: expect.objectContaining({ additionalProperties: false }),
    });
  });

  it("returns stable passages, confidence flags and citations", async () => {
    const result = await createTaskSixToolRegistry()
      .get("search_knowledge")
      .execute(
        {
          query: "未使用的团购券可以退款吗",
          domain: null,
          category: null,
          city: "杭州",
          top_k: 5,
        },
        createToolTestContext({ knowledge: new FakeKnowledgeService() }),
      );

    expect(result).toMatchObject({
      ok: true,
      source: "knowledge_base",
      resultCount: 1,
      data: {
        lowConfidence: false,
        conflict: false,
        isDemo: true,
        passages: [expect.objectContaining({ title: "团购券退款规则" })],
      },
      citations: [expect.objectContaining({ title: "团购券退款规则" })],
    });
  });

  it("returns a successful no-evidence result instead of inventing policy", async () => {
    const enqueue = vi.fn(async () => ({
      candidateId: "64000000-0000-4000-8000-000000000001",
    }));
    const result = await createTaskSixToolRegistry()
      .get("search_knowledge")
      .execute(
        {
          query: "过期两天的团购券一定可以退款吗",
          domain: "group_buy",
          category: "refund",
          city: "杭州",
          top_k: 5,
        },
        createToolTestContext({
          knowledge: new FakeKnowledgeService(),
          knowledgeCandidates: { enqueue },
        }),
      );

    expect(result).toMatchObject({
      ok: true,
      resultCount: 0,
      data: {
        lowConfidence: true,
        passages: [],
        warnings: expect.arrayContaining(["KNOWLEDGE_CANDIDATE_CREATED"]),
      },
      citations: [],
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "no_result",
        sessionId: "71000000-0000-0000-0000-000000000001",
        messageId: "72000000-0000-0000-0000-000000000001",
        domain: "group_buy",
      }),
      expect.any(AbortSignal),
    );
  });
});
