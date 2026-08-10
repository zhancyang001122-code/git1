import { describe, expect, it, vi } from "vitest";

import { createKnowledgeIndexHandler } from "@/app/api/knowledge/index/route";
import type { KnowledgeService } from "@/features/knowledge/types";

const versionId = "62000000-0000-4000-8000-000000000001";

function service(): KnowledgeService {
  return {
    search: vi.fn(),
    indexVersion: vi.fn(async (inputVersionId) => ({
      versionId: inputVersionId,
      totalChunks: 3,
      indexedChunks: 2,
      skippedChunks: 1,
      status: "ready" as const,
    })),
  };
}

describe("POST /api/knowledge/index", () => {
  it("rejects an invalid admin token without indexing", async () => {
    const knowledge = service();
    const post = createKnowledgeIndexHandler(async () => ({
      service: knowledge,
      adminToken: "a-secure-admin-token",
    }));

    const response = await post(
      new Request("http://localhost/api/knowledge/index", {
        method: "POST",
        headers: { authorization: "Bearer wrong-token" },
        body: JSON.stringify({ versionId }),
      }),
    );

    expect(response.status).toBe(401);
    expect(knowledge.indexVersion).not.toHaveBeenCalled();
  });

  it("indexes one version with a valid bearer token", async () => {
    const knowledge = service();
    const post = createKnowledgeIndexHandler(async () => ({
      service: knowledge,
      adminToken: "a-secure-admin-token",
    }));

    const response = await post(
      new Request("http://localhost/api/knowledge/index", {
        method: "POST",
        headers: { authorization: "Bearer a-secure-admin-token" },
        body: JSON.stringify({ versionId }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      versionId,
      indexedChunks: 2,
      status: "ready",
    });
    expect(knowledge.indexVersion).toHaveBeenCalledWith(
      versionId,
      expect.any(AbortSignal),
    );
  });
});
