import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { loadAIOpsDashboard } from "@/features/ai-ops/dashboard";

const row = {
  window_hours: 168,
  generated_at: "2026-08-12T00:00:00.000Z",
  sessions: 3,
  assistant_messages: 5,
  input_tokens: 2000,
  output_tokens: 1000,
  tool_runs: 8,
  tool_failures: 2,
  knowledge_searches: 4,
  knowledge_search_failures: 1,
  feedback_up: 3,
  feedback_down: 1,
  eval_runs: 10,
  eval_passed: 9,
  candidates_created: 2,
  published_versions: 4,
  demo_published_versions: 4,
  ready_chunks: 24,
};

function fakeClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn(async () => result);
  const rpc = vi.fn(() => ({ single }));
  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("AI Ops dashboard", () => {
  it("maps the bounded server aggregate without loading raw conversations", async () => {
    const fake = fakeClient({ data: row, error: null });

    await expect(loadAIOpsDashboard(fake.client, 168)).resolves.toMatchObject({
      windowHours: 168,
      sessions: 3,
      assistantMessages: 5,
      inputTokens: 2000,
      outputTokens: 1000,
      toolRuns: 8,
      toolFailures: 2,
      demoPublishedVersions: 4,
    });
    expect(fake.rpc).toHaveBeenCalledWith("get_ai_ops_dashboard", {
      p_window_hours: 168,
    });
  });

  it("rejects an unbounded window before calling Supabase", async () => {
    const fake = fakeClient({ data: row, error: null });

    await expect(loadAIOpsDashboard(fake.client, 721)).rejects.toMatchObject({
      code: "INVALID_AI_OPS_DASHBOARD_INPUT",
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("normalizes a Supabase failure without exposing database details", async () => {
    const fake = fakeClient({
      data: null,
      error: { message: "sensitive database error" },
    });

    await expect(loadAIOpsDashboard(fake.client)).rejects.toMatchObject({
      code: "AI_OPS_DASHBOARD_QUERY_FAILED",
      message: "AI Ops 汇总暂时不可用",
      retryable: true,
    });
  });

  it("rejects an invalid aggregate shape", async () => {
    const fake = fakeClient({
      data: { ...row, input_tokens: -1 },
      error: null,
    });

    await expect(loadAIOpsDashboard(fake.client)).rejects.toMatchObject({
      code: "INVALID_AI_OPS_DASHBOARD_DATA",
    });
  });
});
