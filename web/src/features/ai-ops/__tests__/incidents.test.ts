import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseIncidentRepository,
  type IncidentRecord,
} from "@/features/ai-ops/incidents";

function fakeRpcClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn(async () => result);
  const rpc = vi.fn(() => ({ single }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

function fakeListRpcClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const incidentRow = {
  id: "85000000-0000-4000-8000-000000000001",
  alert_key: "tool_failure_rate",
  severity: "warning",
  status: "open",
  title: "工具失败率",
  metric_value: "12.5",
  threshold_value: "5",
  sample_count: 24,
  detail: "3 / 24 次工具失败",
  opened_at: "2026-08-12T00:00:00.000Z",
  last_seen_at: "2026-08-12T00:01:00.000Z",
  acknowledged_at: null,
  acknowledged_by: null,
  resolved_at: null,
  resolution_note: null,
  event_count: 1,
  updated_at: "2026-08-12T00:01:00.000Z",
};

describe("SupabaseIncidentRepository", () => {
  it("syncs monitored signals with a bounded window", async () => {
    const fake = fakeRpcClient({
      data: {
        opened_count: 1,
        refreshed_count: 0,
        recovered_count: 0,
        active_count: 1,
        measured_at: "2026-08-12T00:01:00.000Z",
      },
      error: null,
    });

    await expect(
      createSupabaseIncidentRepository(fake.client).sync(24),
    ).resolves.toMatchObject({ openedCount: 1, activeCount: 1 });
    expect(fake.rpc).toHaveBeenCalledWith("sync_ai_ops_incidents", {
      p_window_hours: 24,
    });
  });

  it("loads safe incident metadata without raw tool payloads", async () => {
    const fake = fakeListRpcClient({ data: [incidentRow], error: null });

    const incidents = await createSupabaseIncidentRepository(fake.client).list(
      20,
    );

    expect(incidents).toEqual<IncidentRecord[]>([
      {
        id: incidentRow.id,
        alertKey: "tool_failure_rate",
        severity: "warning",
        status: "open",
        title: "工具失败率",
        metricValue: 12.5,
        thresholdValue: 5,
        sampleCount: 24,
        detail: "3 / 24 次工具失败",
        openedAt: incidentRow.opened_at,
        lastSeenAt: incidentRow.last_seen_at,
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        resolutionNote: null,
        eventCount: 1,
        updatedAt: incidentRow.updated_at,
      },
    ]);
    expect(JSON.stringify(incidents)).not.toContain("input_json");
  });

  it("validates transitions before touching Supabase", async () => {
    const fake = fakeRpcClient({ data: null, error: null });
    await expect(
      createSupabaseIncidentRepository(fake.client).transition({
        incidentId: incidentRow.id,
        action: "resolve",
        actorLabel: "portfolio_admin",
        note: " ",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INCIDENT_TRANSITION" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("maps a successful acknowledgement", async () => {
    const acknowledged = {
      ...incidentRow,
      status: "acknowledged",
      acknowledged_at: "2026-08-12T00:02:00.000Z",
      acknowledged_by: "portfolio_admin",
    };
    const fake = fakeRpcClient({ data: acknowledged, error: null });

    await expect(
      createSupabaseIncidentRepository(fake.client).transition({
        incidentId: incidentRow.id,
        action: "acknowledge",
        actorLabel: "portfolio_admin",
        note: "开始排查",
      }),
    ).resolves.toMatchObject({ status: "acknowledged" });
    expect(fake.rpc).toHaveBeenCalledWith("transition_ai_ops_incident", {
      p_incident_id: incidentRow.id,
      p_action: "acknowledge",
      p_actor_label: "portfolio_admin",
      p_note: "开始排查",
    });
  });

  it.each([
    ["P0002", "AI_OPS_INCIDENT_NOT_FOUND", 404],
    ["22023", "INVALID_INCIDENT_STATE", 409],
  ])(
    "maps transition database error %s to a stable public error",
    async (databaseCode, publicCode, status) => {
      const fake = fakeRpcClient({
        data: null,
        error: { code: databaseCode, message: "database detail" },
      });

      await expect(
        createSupabaseIncidentRepository(fake.client).transition({
          incidentId: incidentRow.id,
          action: "acknowledge",
          actorLabel: "portfolio_admin",
          note: null,
        }),
      ).rejects.toMatchObject({ code: publicCode, status });
    },
  );
});
