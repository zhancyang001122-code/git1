import { describe, expect, it, vi } from "vitest";

import { createKnowledgeEvaluateHandler } from "@/app/api/knowledge/evaluate/route";

const token = "demo-admin-token-that-is-at-least-32-chars";
const candidateId = "64000000-0000-4000-8000-000000000001";

function runtime(evaluate = vi.fn()) {
  return {
    mode: "demo" as const,
    adminToken: token,
    service: { evaluate } as never,
  };
}

describe("POST /api/knowledge/evaluate", () => {
  it("authenticates before consuming shared rate-limit capacity", async () => {
    const rateLimiter = { check: vi.fn() };
    const post = createKnowledgeEvaluateHandler(
      async () => runtime(),
      rateLimiter,
    );
    const response = await post(
      new Request("http://localhost/api/knowledge/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId }),
      }),
    );

    expect(response.status).toBe(401);
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it("rejects a shared rate-limit overflow before evaluation", async () => {
    const evaluate = vi.fn();
    const post = createKnowledgeEvaluateHandler(async () => runtime(evaluate), {
      check: () => ({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 31,
      }),
    });
    const response = await post(
      new Request("http://localhost/api/knowledge/evaluate", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ candidateId }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("31");
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before evaluation", async () => {
    const evaluate = vi.fn();
    const post = createKnowledgeEvaluateHandler(async () => runtime(evaluate), {
      check: () => ({ allowed: true, remaining: 1, retryAfterSeconds: 60 }),
    });
    const response = await post(
      new Request("http://localhost/api/knowledge/evaluate", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ padding: "测".repeat(3_000) }),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_BODY_TOO_LARGE" },
    });
    expect(evaluate).not.toHaveBeenCalled();
  });
});
