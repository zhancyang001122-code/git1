import { describe, expect, it, vi } from "vitest";

import { createKnowledgeRollbackHandler } from "@/app/api/knowledge/rollback/route";

const token = "demo-admin-token-that-is-at-least-32-chars";
const candidateId = "64000000-0000-4000-8000-000000000001";

describe("POST /api/knowledge/rollback", () => {
  it("requires admin authorization and returns the restored version", async () => {
    const rollback = vi.fn(async () => ({
      candidateId,
      articleId: "61000000-0000-4000-8000-000000000009",
      versionId: "62000000-0000-4000-8000-000000000008",
      rolledBack: true as const,
      isDemo: true,
    }));
    const post = createKnowledgeRollbackHandler(async () => ({
      mode: "demo",
      adminToken: token,
      service: { rollback } as never,
    }));

    const unauthorized = await post(
      new Request("http://localhost/api/knowledge/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId }),
      }),
    );
    expect(unauthorized.status).toBe(401);

    const response = await post(
      new Request("http://localhost/api/knowledge/rollback", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ candidateId }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      candidateId,
      versionId: "62000000-0000-4000-8000-000000000008",
      rolledBack: true,
      isDemo: true,
    });
  });
});
