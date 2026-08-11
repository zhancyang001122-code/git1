import { describe, expect, it, vi } from "vitest";

import { createKnowledgeIndexWorkerHandler } from "@/app/api/internal/knowledge-index-worker/route";
import {
  createKnowledgeAdminSession,
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
} from "@/features/knowledge-ops/admin-session";

const cronSecret = "cron-secret-that-is-at-least-32-characters";

describe("knowledge index worker route", () => {
  it("rejects requests without the cron or admin credential", async () => {
    const runOne = vi.fn();
    const handler = createKnowledgeIndexWorkerHandler(async () => ({
      worker: { runOne },
      cronSecret,
      adminToken: undefined,
    }));

    const response = await handler(
      new Request("http://localhost/api/internal/knowledge-index-worker"),
    );

    expect(response.status).toBe(401);
    expect(runOne).not.toHaveBeenCalled();
  });

  it("processes one job for Vercel Cron without exposing credentials", async () => {
    const runOne = vi.fn(async () => ({ status: "idle" as const }));
    const handler = createKnowledgeIndexWorkerHandler(async () => ({
      worker: { runOne },
      cronSecret,
      adminToken: undefined,
    }));

    const response = await handler(
      new Request("http://localhost/api/internal/knowledge-index-worker", {
        headers: { authorization: `Bearer ${cronSecret}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "idle" });
    expect(runOne).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.any(AbortSignal),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows the signed HttpOnly admin session used by the management page", async () => {
    const adminToken = "admin-token-that-is-at-least-32-characters";
    const runOne = vi.fn(async () => ({ status: "idle" as const }));
    const handler = createKnowledgeIndexWorkerHandler(async () => ({
      worker: { runOne },
      cronSecret: undefined,
      adminToken,
    }));

    const response = await handler(
      new Request("http://localhost/api/internal/knowledge-index-worker", {
        headers: {
          cookie: `${KNOWLEDGE_ADMIN_SESSION_COOKIE}=${createKnowledgeAdminSession(adminToken)}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(runOne).toHaveBeenCalledOnce();
  });
});
