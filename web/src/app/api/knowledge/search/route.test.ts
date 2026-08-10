import { describe, expect, it, vi } from "vitest";

import { createKnowledgeSearchHandler } from "@/app/api/knowledge/search/route";
import type { KnowledgeService } from "@/features/knowledge/types";

function service(): KnowledgeService {
  return {
    search: vi.fn(async (input) => ({
      chunks: [],
      citations: [],
      lowConfidence: true,
      conflict: false,
      queryPlan: { rewrittenQuery: input.query },
      warnings: [],
      isDemo: true,
    })),
    indexVersion: vi.fn(async (versionId) => ({
      versionId,
      totalChunks: 0,
      indexedChunks: 0,
      skippedChunks: 0,
      status: "ready" as const,
    })),
  };
}

describe("POST /api/knowledge/search", () => {
  it("rejects invalid query input before calling the service", async () => {
    const knowledge = service();
    const post = createKnowledgeSearchHandler(async () => knowledge);

    const response = await post(
      new Request("http://localhost/api/knowledge/search", {
        method: "POST",
        body: JSON.stringify({ query: "x" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(knowledge.search).not.toHaveBeenCalled();
  });

  it("returns the stable search result and disables caching", async () => {
    const knowledge = service();
    const post = createKnowledgeSearchHandler(async () => knowledge);
    const response = await post(
      new Request("http://localhost/api/knowledge/search", {
        method: "POST",
        body: JSON.stringify({
          query: "团购券退款规则",
          domain: "group_buy",
          category: "refund",
          city: "杭州",
          topK: 5,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ lowConfidence: true });
    expect(knowledge.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: "团购券退款规则", topK: 5 }),
      expect.any(AbortSignal),
    );
  });
});
