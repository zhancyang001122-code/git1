import { describe, expect, it, vi } from "vitest";

import { createKnowledgePublishHandler } from "@/app/api/knowledge/publish/route";

const token = "demo-admin-token-that-is-at-least-32-chars";
const candidateId = "64000000-0000-4000-8000-000000000001";

describe("POST /api/knowledge/publish", () => {
  it("returns the explicit publication, index and evaluation states", async () => {
    const publish = vi.fn(async () => ({
      candidateId,
      articleId: "61000000-0000-4000-8000-000000000009",
      versionId: "62000000-0000-4000-8000-000000000009",
      publicationStatus: "published" as const,
      indexStatus: "ready" as const,
      evaluationStatus: "passed" as const,
      searchable: true,
      rollbackAvailable: false,
      warnings: [],
      isDemo: true,
    }));
    const post = createKnowledgePublishHandler(async () => ({
      mode: "demo",
      adminToken: token,
      service: { publish } as never,
    }));
    const response = await post(
      new Request("http://localhost/api/knowledge/publish", {
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
      publicationStatus: "published",
      indexStatus: "ready",
      evaluationStatus: "passed",
      searchable: true,
      isDemo: true,
    });
  });
});
