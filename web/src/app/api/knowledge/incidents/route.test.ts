import { describe, expect, it, vi } from "vitest";

import { createIncidentHandlers } from "@/app/api/knowledge/incidents/route";
import {
  createKnowledgeAdminSession,
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
} from "@/features/knowledge-ops/admin-session";

const adminToken = "admin-token-that-is-at-least-32-characters";
const incidentId = "85000000-0000-4000-8000-000000000001";
const acknowledgedIncident = {
  id: incidentId,
  alertKey: "tool_failure_rate" as const,
  severity: "warning" as const,
  status: "acknowledged" as const,
  title: "工具失败率",
  metricValue: 12.5,
  thresholdValue: 5,
  sampleCount: 24,
  detail: "3 / 24 次工具失败",
  openedAt: "2026-08-12T00:00:00.000Z",
  lastSeenAt: "2026-08-12T00:01:00.000Z",
  acknowledgedAt: "2026-08-12T00:02:00.000Z",
  acknowledgedBy: "portfolio_admin",
  resolvedAt: null,
  resolutionNote: null,
  eventCount: 2,
  updatedAt: "2026-08-12T00:02:00.000Z",
};

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/knowledge/incidents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${KNOWLEDGE_ADMIN_SESSION_COOKIE}=${createKnowledgeAdminSession(adminToken)}`,
      origin,
    },
    body: JSON.stringify(body),
  });
}

describe("knowledge incident route", () => {
  it("lists incidents only for an authorized admin", async () => {
    const list = vi.fn(async () => [acknowledgedIncident]);
    const handlers = createIncidentHandlers(async () => ({
      repository: { sync: vi.fn(), list, transition: vi.fn() },
      adminToken,
    }));
    const response = await handlers.GET(
      new Request("http://localhost/api/knowledge/incidents", {
        headers: {
          cookie: `${KNOWLEDGE_ADMIN_SESSION_COOKIE}=${createKnowledgeAdminSession(adminToken)}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      incidents: [acknowledgedIncident],
    });
    expect(list).toHaveBeenCalledWith(20);
  });

  it("rejects cross-origin writes before transition", async () => {
    const transition = vi.fn();
    const handlers = createIncidentHandlers(async () => ({
      repository: { sync: vi.fn(), list: vi.fn(), transition },
      adminToken,
    }));

    const response = await handlers.POST(
      request(
        { incidentId, action: "acknowledge", note: "开始排查" },
        "https://evil.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(transition).not.toHaveBeenCalled();
  });

  it("validates and acknowledges an incident", async () => {
    const transition = vi.fn(async () => acknowledgedIncident);
    const handlers = createIncidentHandlers(async () => ({
      repository: { sync: vi.fn(), list: vi.fn(), transition },
      adminToken,
    }));

    const response = await handlers.POST(
      request({ incidentId, action: "acknowledge", note: "开始排查" }),
    );

    expect(response.status).toBe(200);
    expect(transition).toHaveBeenCalledWith({
      incidentId,
      action: "acknowledge",
      actorLabel: "portfolio_admin",
      note: "开始排查",
    });
  });

  it("requires a resolution note", async () => {
    const transition = vi.fn();
    const handlers = createIncidentHandlers(async () => ({
      repository: { sync: vi.fn(), list: vi.fn(), transition },
      adminToken,
    }));
    const response = await handlers.POST(
      request({ incidentId, action: "resolve", note: "" }),
    );

    expect(response.status).toBe(400);
    expect(transition).not.toHaveBeenCalled();
  });
});
