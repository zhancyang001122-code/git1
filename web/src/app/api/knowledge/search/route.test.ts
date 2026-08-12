import { describe, expect, it, vi } from "vitest";

import { createKnowledgeSearchHandler } from "@/app/api/knowledge/search/route";
import type { KnowledgeService } from "@/features/knowledge/types";
import type { RateLimiter } from "@/lib/rate-limit";

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
  it("rejects oversized bodies before creating the knowledge runtime", async () => {
    const runtimeFactory = vi.fn(async () => service());
    const post = createKnowledgeSearchHandler(runtimeFactory);

    const response = await post(
      new Request("http://localhost/api/knowledge/search", {
        method: "POST",
        body: JSON.stringify({ query: "x".repeat(9_000) }),
      }),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("REQUEST_BODY_TOO_LARGE");
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it("returns shared rate-limit metadata before executing retrieval", async () => {
    const runtimeFactory = vi.fn(async () => service());
    const limiter: RateLimiter = {
      check: async () => ({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 17,
      }),
    };
    const post = createKnowledgeSearchHandler(runtimeFactory, limiter);

    const response = await post(
      new Request("http://localhost/api/knowledge/search", {
        method: "POST",
        body: JSON.stringify({ query: "团购券退款规则" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

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
