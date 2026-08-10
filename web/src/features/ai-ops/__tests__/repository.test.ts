import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabaseAIOpsRepository } from "@/features/ai-ops/repository";

interface Call {
  method: string;
  args: unknown[];
}

function fakeClient(response: { data: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const builder = new Proxy(
    {
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({
          data: response.data,
          error: response.error ?? null,
        }).then(resolve);
      },
    },
    {
      get(target, property) {
        if (property === "then") return target.then.bind(target);
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

const sessionId = "71000000-0000-0000-0000-000000000001";
const messageId = "72000000-0000-0000-0000-000000000001";

describe("SupabaseAIOpsRepository", () => {
  it("records a redacted tool run with an explicit request id", async () => {
    const row = {
      id: "73000000-0000-0000-0000-000000000001",
      session_id: sessionId,
      message_id: messageId,
      tool_name: "search_houses",
      status: "succeeded",
      input_json: { district: "拱墅区" },
      output_summary: { resultCount: 2 },
      source_label: "Supabase",
      duration_ms: 31,
      error_code: null,
      request_id: "74000000-0000-0000-0000-000000000001",
      started_at: "2026-08-11T00:00:00.000Z",
      completed_at: "2026-08-11T00:00:00.031Z",
      created_at: "2026-08-11T00:00:00.000Z",
    };
    const fake = fakeClient({ data: row });
    await createSupabaseAIOpsRepository(fake.client).recordToolRun({
      sessionId,
      messageId,
      toolName: "search_houses",
      status: "succeeded",
      input: { district: "拱墅区" },
      outputSummary: { resultCount: 2 },
      sourceLabel: "Supabase",
      durationMs: 31,
      requestId: "74000000-0000-0000-0000-000000000001",
      startedAt: "2026-08-11T00:00:00.000Z",
      completedAt: "2026-08-11T00:00:00.031Z",
    });

    expect(fake.calls).toContainEqual({
      method: "from",
      args: ["ai_tool_runs"],
    });
    expect(
      String(fake.calls.find((call) => call.method === "select")?.args[0]),
    ).not.toContain("*");
  });

  it("rejects unbounded tool input before touching Supabase", async () => {
    const fake = fakeClient({ data: null });
    await expect(
      createSupabaseAIOpsRepository(fake.client).recordToolRun({
        toolName: "search_houses",
        status: "running",
        input: { text: "x".repeat(5000) },
        requestId: "74000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toMatchObject({ code: "INVALID_AI_OPS_INPUT" });
    expect(fake.calls).toHaveLength(0);
  });

  it("upserts one feedback record per user and message", async () => {
    const userId = "70000000-0000-0000-0000-000000000001";
    const row = {
      id: "75000000-0000-0000-0000-000000000001",
      user_id: userId,
      session_id: sessionId,
      message_id: messageId,
      rating: "down",
      reason: "missing_source",
      comment: "缺少引用",
      created_at: "2026-08-11T00:00:00.000Z",
    };
    const fake = fakeClient({ data: row });
    await createSupabaseAIOpsRepository(fake.client).upsertFeedback({
      userId,
      sessionId,
      messageId,
      rating: "down",
      reason: "missing_source",
      comment: "缺少引用",
    });

    expect(
      fake.calls.find((call) => call.method === "upsert")?.args[1],
    ).toEqual({ onConflict: "message_id,user_id" });
  });
});
