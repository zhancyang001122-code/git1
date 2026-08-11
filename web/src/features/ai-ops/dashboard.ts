import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const windowHoursSchema = z.number().int().min(1).max(720);
const metricSchema = z.coerce.number().int().nonnegative();
const dashboardRowSchema = z.object({
  window_hours: metricSchema,
  generated_at: z.string().datetime({ offset: true }),
  sessions: metricSchema,
  assistant_messages: metricSchema,
  input_tokens: metricSchema,
  output_tokens: metricSchema,
  tool_runs: metricSchema,
  tool_failures: metricSchema,
  knowledge_searches: metricSchema,
  knowledge_search_failures: metricSchema,
  feedback_up: metricSchema,
  feedback_down: metricSchema,
  eval_runs: metricSchema,
  eval_passed: metricSchema,
  candidates_created: metricSchema,
  published_versions: metricSchema,
  demo_published_versions: metricSchema,
  ready_chunks: metricSchema,
});

export interface AIOpsDashboard {
  windowHours: number;
  generatedAt: string;
  sessions: number;
  assistantMessages: number;
  inputTokens: number;
  outputTokens: number;
  toolRuns: number;
  toolFailures: number;
  knowledgeSearches: number;
  knowledgeSearchFailures: number;
  feedbackUp: number;
  feedbackDown: number;
  evalRuns: number;
  evalPassed: number;
  candidatesCreated: number;
  publishedVersions: number;
  demoPublishedVersions: number;
  readyChunks: number;
}

export async function loadAIOpsDashboard(
  client: SupabaseClient,
  windowHours = 168,
): Promise<AIOpsDashboard> {
  const input = windowHoursSchema.safeParse(windowHours);
  if (!input.success) {
    throw new AppError({
      code: "INVALID_AI_OPS_DASHBOARD_INPUT",
      message: "AI Ops 统计窗口必须是 1 至 720 小时的整数",
      status: 400,
    });
  }

  const result = await client
    .rpc("get_ai_ops_dashboard", { p_window_hours: input.data })
    .single();
  if (result.error) {
    throw new AppError({
      code: "AI_OPS_DASHBOARD_QUERY_FAILED",
      message: "AI Ops 汇总暂时不可用",
      status: 503,
      retryable: true,
      cause: result.error,
    });
  }

  const parsed = dashboardRowSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_AI_OPS_DASHBOARD_DATA",
      message: "AI Ops 汇总返回了无效数据",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }

  const row = parsed.data;
  return {
    windowHours: row.window_hours,
    generatedAt: row.generated_at,
    sessions: row.sessions,
    assistantMessages: row.assistant_messages,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    toolRuns: row.tool_runs,
    toolFailures: row.tool_failures,
    knowledgeSearches: row.knowledge_searches,
    knowledgeSearchFailures: row.knowledge_search_failures,
    feedbackUp: row.feedback_up,
    feedbackDown: row.feedback_down,
    evalRuns: row.eval_runs,
    evalPassed: row.eval_passed,
    candidatesCreated: row.candidates_created,
    publishedVersions: row.published_versions,
    demoPublishedVersions: row.demo_published_versions,
    readyChunks: row.ready_chunks,
  };
}
