import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  apiRouteLogFiltersFromSearchParams,
  loadAIOpsDashboard,
  loadAIModelUsage,
  loadApiRouteLogs,
  loadOperationalAlerts,
  loadRAGOpsTrend,
  loadToolRunLogs,
  toolRunLogFiltersFromSearchParams,
} from "@/features/ai-ops/dashboard";

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

function fakeListClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => result);
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

describe("RAG Ops trend", () => {
  it("maps daily server aggregates without loading raw tool payloads", async () => {
    const fake = fakeListClient({
      data: [
        {
          bucket_date: "2026-08-11",
          knowledge_searches: 4,
          knowledge_successes: 3,
          no_result_searches: 1,
          avg_duration_ms: 220,
          feedback_up: 2,
          feedback_down: 1,
          eval_runs: 3,
          eval_passed: 2,
          candidates_created: 1,
        },
      ],
      error: null,
    });

    await expect(loadRAGOpsTrend(fake.client, 7)).resolves.toEqual([
      {
        date: "2026-08-11",
        knowledgeSearches: 4,
        knowledgeSuccesses: 3,
        noResultSearches: 1,
        averageDurationMs: 220,
        feedbackUp: 2,
        feedbackDown: 1,
        evalRuns: 3,
        evalPassed: 2,
        candidatesCreated: 1,
      },
    ]);
    expect(fake.rpc).toHaveBeenCalledWith("get_rag_ops_trend", { p_days: 7 });
  });

  it("rejects an invalid trend window before calling Supabase", async () => {
    const fake = fakeListClient({ data: [], error: null });

    await expect(loadRAGOpsTrend(fake.client, 31)).rejects.toMatchObject({
      code: "INVALID_RAG_OPS_TREND_INPUT",
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe("AI model usage", () => {
  it("maps request-level token buckets without loading message content", async () => {
    const fake = fakeListClient({
      data: [
        {
          model_name: "qwen-plus",
          input_tokens: 2000,
          output_tokens: 1000,
          requests: 3,
        },
        {
          model_name: "unknown",
          input_tokens: null,
          output_tokens: null,
          requests: 1,
        },
      ],
      error: null,
    });

    await expect(loadAIModelUsage(fake.client, 168)).resolves.toEqual([
      {
        modelName: "qwen-plus",
        inputTokens: 2000,
        outputTokens: 1000,
        requests: 3,
      },
      {
        modelName: "unknown",
        inputTokens: null,
        outputTokens: null,
        requests: 1,
      },
    ]);
    expect(fake.rpc).toHaveBeenCalledWith("get_ai_model_usage", {
      p_window_hours: 168,
    });
  });
});

describe("central operational monitoring", () => {
  it("fails closed to unfiltered safe defaults for malformed URL filters", () => {
    expect(
      toolRunLogFiltersFromSearchParams({
        toolStatus: ["failed", "succeeded"],
        toolName: ["search_knowledge", "search_products"],
      }),
    ).toEqual({ limit: 20 });
    expect(
      toolRunLogFiltersFromSearchParams({
        toolStatus: "running",
        toolName: "search_knowledge; drop table",
      }),
    ).toEqual({ limit: 20 });
  });

  it("maps alert thresholds and sample sufficiency without raw payloads", async () => {
    const fake = fakeListClient({
      data: [
        {
          alert_key: "tool_failure_rate",
          severity: "warning",
          state: "alert",
          title: "工具失败率",
          metric_value: "12.5",
          threshold_value: "5",
          sample_count: 24,
          detail: "3 / 24 次终态工具调用失败或超时",
          measured_at: "2026-08-12T00:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(loadOperationalAlerts(fake.client, 24)).resolves.toEqual([
      {
        key: "tool_failure_rate",
        severity: "warning",
        state: "alert",
        title: "工具失败率",
        metricValue: 12.5,
        thresholdValue: 5,
        sampleCount: 24,
        detail: "3 / 24 次终态工具调用失败或超时",
        measuredAt: "2026-08-12T00:00:00.000Z",
      },
    ]);
    expect(fake.rpc).toHaveBeenCalledWith("get_ai_ops_alerts", {
      p_window_hours: 24,
    });
  });

  it("loads filtered cross-instance tool audit logs", async () => {
    const fake = fakeListClient({
      data: [
        {
          id: "73000000-0000-4000-8000-000000000001",
          tool_name: "search_knowledge",
          status: "failed",
          source_label: "知识库",
          duration_ms: 250,
          error_code: "KNOWLEDGE_TIMEOUT",
          request_id: "74000000-0000-4000-8000-000000000001",
          created_at: "2026-08-12T00:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(
      loadToolRunLogs(fake.client, {
        limit: 20,
        status: "failed",
        toolName: "search_knowledge",
      }),
    ).resolves.toEqual([
      {
        id: "73000000-0000-4000-8000-000000000001",
        toolName: "search_knowledge",
        status: "failed",
        sourceLabel: "知识库",
        durationMs: 250,
        errorCode: "KNOWLEDGE_TIMEOUT",
        requestId: "74000000-0000-4000-8000-000000000001",
        createdAt: "2026-08-12T00:00:00.000Z",
      },
    ]);
    expect(fake.rpc).toHaveBeenCalledWith("search_ai_tool_run_logs", {
      p_limit: 20,
      p_status: "failed",
      p_tool_name: "search_knowledge",
    });
  });

  it("rejects unsafe log filters before calling Supabase", async () => {
    const fake = fakeListClient({ data: [], error: null });

    await expect(
      loadToolRunLogs(fake.client, {
        status: "running" as never,
        toolName: "search_knowledge; drop table",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TOOL_RUN_LOG_FILTER" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid alert rows instead of rendering false assurance", async () => {
    const fake = fakeListClient({
      data: [
        {
          alert_key: "tool_failure_rate",
          severity: "warning",
          state: "healthy-ish",
          title: "工具失败率",
          metric_value: 0,
          threshold_value: 5,
          sample_count: 20,
          detail: "invalid state",
          measured_at: "2026-08-12T00:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(loadOperationalAlerts(fake.client)).rejects.toMatchObject({
      code: "INVALID_AI_OPS_ALERT_DATA",
    });
  });

  it("loads bounded cross-instance API route metadata", async () => {
    const fake = fakeListClient({
      data: [
        {
          id: "75000000-0000-4000-8000-000000000001",
          route_key: "/api/maps/nearby",
          method: "POST",
          status_code: 502,
          duration_ms: 320,
          request_id: "76000000-0000-4000-8000-000000000001",
          error_code: "AMAP_UPSTREAM_FAILED",
          created_at: "2026-08-12T00:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(
      loadApiRouteLogs(fake.client, {
        limit: 20,
        method: "POST",
        statusClass: 5,
      }),
    ).resolves.toEqual([
      {
        id: "75000000-0000-4000-8000-000000000001",
        routeKey: "/api/maps/nearby",
        method: "POST",
        statusCode: 502,
        durationMs: 320,
        requestId: "76000000-0000-4000-8000-000000000001",
        errorCode: "AMAP_UPSTREAM_FAILED",
        createdAt: "2026-08-12T00:00:00.000Z",
      },
    ]);
    expect(fake.rpc).toHaveBeenCalledWith("search_api_route_logs", {
      p_limit: 20,
      p_method: "POST",
      p_status_class: 5,
    });
  });

  it("fails closed to safe API route filters", () => {
    expect(
      apiRouteLogFiltersFromSearchParams({
        routeMethod: ["GET", "POST"],
        routeStatus: "9",
      }),
    ).toEqual({ limit: 20 });
    expect(
      apiRouteLogFiltersFromSearchParams({
        routeMethod: "POST",
        routeStatus: "5",
      }),
    ).toEqual({ limit: 20, method: "POST", statusClass: 5 });
  });
});
