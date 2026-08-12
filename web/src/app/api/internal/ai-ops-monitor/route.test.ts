import { describe, expect, it, vi } from "vitest";

import { createAiOpsMonitorHandler } from "@/app/api/internal/ai-ops-monitor/route";

const cronSecret = "cron-secret-that-is-at-least-32-characters";

describe("AI Ops monitor route", () => {
  it("rejects requests without cron or admin credentials", async () => {
    const sync = vi.fn();
    const response = await createAiOpsMonitorHandler(async () => ({
      repository: { sync, list: vi.fn(), transition: vi.fn() },
      cronSecret,
      adminToken: undefined,
    }))(new Request("http://localhost/api/internal/ai-ops-monitor"));

    expect(response.status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it("syncs incidents for an authorized Vercel Cron request", async () => {
    const sync = vi.fn(async () => ({
      openedCount: 1,
      refreshedCount: 0,
      recoveredCount: 0,
      activeCount: 1,
      measuredAt: "2026-08-12T00:00:00.000Z",
    }));
    const response = await createAiOpsMonitorHandler(async () => ({
      repository: { sync, list: vi.fn(), transition: vi.fn() },
      cronSecret,
      adminToken: undefined,
    }))(
      new Request("http://localhost/api/internal/ai-ops-monitor", {
        headers: { authorization: `Bearer ${cronSecret}` },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ activeCount: 1 });
    expect(sync).toHaveBeenCalledWith(24);
  });
});
