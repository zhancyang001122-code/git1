import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import type { AIModelUsageBucket } from "@/features/ai-ops/pricing";

const windowHoursSchema = z.number().int().min(1).max(720);
const metricSchema = z.coerce.number().int().nonnegative();
const dayWindowSchema = z.number().int().min(1).max(30);
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

const ragTrendRowSchema = z.object({
  bucket_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  knowledge_searches: metricSchema,
  knowledge_successes: metricSchema,
  no_result_searches: metricSchema,
  avg_duration_ms: metricSchema.nullable(),
  feedback_up: metricSchema,
  feedback_down: metricSchema,
  eval_runs: metricSchema,
  eval_passed: metricSchema,
  candidates_created: metricSchema,
});

const modelUsageRowSchema = z.object({
  model_name: z.string().min(1),
  input_tokens: metricSchema.nullable(),
  output_tokens: metricSchema.nullable(),
  requests: metricSchema,
});
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const operationalAlertRowSchema = z.object({
  alert_key: z.enum([
    "tool_failure_rate",
    "rag_no_result_rate",
    "knowledge_index_backlog",
    "rag_eval_failure_rate",
  ]),
  severity: z.enum(["warning", "critical"]),
  state: z.enum(["alert", "ok", "insufficient_data"]),
  title: z.string().min(1).max(80),
  metric_value: z.coerce.number().finite().nonnegative(),
  threshold_value: z.coerce.number().finite().nonnegative(),
  sample_count: metricSchema,
  detail: z.string().min(1).max(240),
  measured_at: z.string().datetime({ offset: true }),
});
const toolRunLogStatusSchema = z.enum(["succeeded", "failed", "timed_out"]);
const toolRunLogRowSchema = z.object({
  id: uuidSchema,
  tool_name: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  status: toolRunLogStatusSchema,
  source_label: z.string().max(120).nullable(),
  duration_ms: metricSchema.nullable(),
  error_code: z.string().max(120).nullable(),
  request_id: uuidSchema,
  created_at: z.string().datetime({ offset: true }),
});
const toolRunLogFiltersSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    status: toolRunLogStatusSchema.optional(),
    toolName: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{1,79}$/)
      .optional(),
  })
  .strict();
const apiRouteMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const apiRouteLogRowSchema = z.object({
  id: uuidSchema,
  route_key: z.string().regex(/^\/api\/[a-z0-9_\-/[\]]{1,180}$/),
  method: apiRouteMethodSchema,
  status_code: z.coerce.number().int().min(100).max(599),
  duration_ms: metricSchema.max(300_000),
  request_id: uuidSchema,
  error_code: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,119}$/)
    .nullable(),
  created_at: z.string().datetime({ offset: true }),
});
const apiRouteLogFiltersSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    method: apiRouteMethodSchema.optional(),
    statusClass: z.number().int().min(2).max(5).optional(),
  })
  .strict();

export interface RAGOpsTrendPoint {
  date: string;
  knowledgeSearches: number;
  knowledgeSuccesses: number;
  noResultSearches: number;
  averageDurationMs: number | null;
  feedbackUp: number;
  feedbackDown: number;
  evalRuns: number;
  evalPassed: number;
  candidatesCreated: number;
}

export type OperationalAlert = {
  key: z.infer<typeof operationalAlertRowSchema>["alert_key"];
  severity: z.infer<typeof operationalAlertRowSchema>["severity"];
  state: z.infer<typeof operationalAlertRowSchema>["state"];
  title: string;
  metricValue: number;
  thresholdValue: number;
  sampleCount: number;
  detail: string;
  measuredAt: string;
};

export type ToolRunLogStatus = z.infer<typeof toolRunLogStatusSchema>;
export interface ToolRunLogFilters {
  limit?: number;
  status?: ToolRunLogStatus;
  toolName?: string;
}
export interface ToolRunLogEntry {
  id: string;
  toolName: string;
  status: ToolRunLogStatus;
  sourceLabel: string | null;
  durationMs: number | null;
  errorCode: string | null;
  requestId: string;
  createdAt: string;
}
export type ApiRouteMethod = z.infer<typeof apiRouteMethodSchema>;
export interface ApiRouteLogFilters {
  limit?: number;
  method?: ApiRouteMethod;
  statusClass?: number;
}
export interface ApiRouteLogEntry {
  id: string;
  routeKey: string;
  method: ApiRouteMethod;
  statusCode: number;
  durationMs: number;
  requestId: string;
  errorCode: string | null;
  createdAt: string;
}

export function toolRunLogFiltersFromSearchParams(input: {
  toolStatus?: unknown;
  toolName?: unknown;
}): ToolRunLogFilters {
  const toolStatus =
    typeof input.toolStatus === "string" ? input.toolStatus : undefined;
  const toolName =
    typeof input.toolName === "string" ? input.toolName.trim() : undefined;
  const parsed = toolRunLogFiltersSchema.safeParse({
    limit: 20,
    status: toolStatus || undefined,
    toolName: toolName || undefined,
  });
  return parsed.success ? parsed.data : { limit: 20 };
}

export function apiRouteLogFiltersFromSearchParams(input: {
  routeMethod?: unknown;
  routeStatus?: unknown;
}): ApiRouteLogFilters {
  const method =
    typeof input.routeMethod === "string" ? input.routeMethod : undefined;
  const statusClass =
    typeof input.routeStatus === "string" && /^[2-5]$/.test(input.routeStatus)
      ? Number(input.routeStatus)
      : undefined;
  const parsed = apiRouteLogFiltersSchema.safeParse({
    limit: 20,
    method: method || undefined,
    statusClass,
  });
  return parsed.success ? parsed.data : { limit: 20 };
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

export async function loadRAGOpsTrend(
  client: SupabaseClient,
  days = 7,
): Promise<readonly RAGOpsTrendPoint[]> {
  const input = dayWindowSchema.safeParse(days);
  if (!input.success) {
    throw new AppError({
      code: "INVALID_RAG_OPS_TREND_INPUT",
      message: "RAG 趋势窗口必须是 1 至 30 天的整数",
      status: 400,
    });
  }

  const result = await client.rpc("get_rag_ops_trend", {
    p_days: input.data,
  });
  if (result.error) {
    throw new AppError({
      code: "RAG_OPS_TREND_QUERY_FAILED",
      message: "RAG 趋势暂时不可用",
      status: 503,
      retryable: true,
      cause: result.error,
    });
  }

  const parsed = z.array(ragTrendRowSchema).safeParse(result.data);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_RAG_OPS_TREND_DATA",
      message: "RAG 趋势返回了无效数据",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }

  return parsed.data.map((row) => ({
    date: row.bucket_date,
    knowledgeSearches: row.knowledge_searches,
    knowledgeSuccesses: row.knowledge_successes,
    noResultSearches: row.no_result_searches,
    averageDurationMs: row.avg_duration_ms,
    feedbackUp: row.feedback_up,
    feedbackDown: row.feedback_down,
    evalRuns: row.eval_runs,
    evalPassed: row.eval_passed,
    candidatesCreated: row.candidates_created,
  }));
}

export async function loadAIModelUsage(
  client: SupabaseClient,
  windowHours = 168,
): Promise<readonly AIModelUsageBucket[]> {
  const input = windowHoursSchema.safeParse(windowHours);
  if (!input.success) {
    throw new AppError({
      code: "INVALID_AI_MODEL_USAGE_INPUT",
      message: "模型用量统计窗口必须是 1 至 720 小时的整数",
      status: 400,
    });
  }
  const result = await client.rpc("get_ai_model_usage", {
    p_window_hours: input.data,
  });
  if (result.error) {
    throw new AppError({
      code: "AI_MODEL_USAGE_QUERY_FAILED",
      message: "模型用量汇总暂时不可用",
      status: 503,
      retryable: true,
      cause: result.error,
    });
  }
  const parsed = z.array(modelUsageRowSchema).safeParse(result.data);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_AI_MODEL_USAGE_DATA",
      message: "模型用量汇总返回了无效数据",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }
  return parsed.data.map((row) => ({
    modelName: row.model_name,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    requests: row.requests,
  }));
}

export async function loadOperationalAlerts(
  client: SupabaseClient,
  windowHours = 24,
): Promise<readonly OperationalAlert[]> {
  const input = windowHoursSchema.safeParse(windowHours);
  if (!input.success) {
    throw new AppError({
      code: "INVALID_AI_OPS_ALERT_INPUT",
      message: "告警统计窗口必须是 1 至 720 小时的整数",
      status: 400,
    });
  }
  const result = await client.rpc("get_ai_ops_alerts", {
    p_window_hours: input.data,
  });
  if (result.error) {
    throw new AppError({
      code: "AI_OPS_ALERT_QUERY_FAILED",
      message: "AI Ops 告警状态暂时不可用",
      status: 503,
      retryable: true,
      cause: result.error,
    });
  }
  const parsed = z.array(operationalAlertRowSchema).safeParse(result.data);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_AI_OPS_ALERT_DATA",
      message: "AI Ops 告警返回了无效数据",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }
  return parsed.data.map((row) => ({
    key: row.alert_key,
    severity: row.severity,
    state: row.state,
    title: row.title,
    metricValue: row.metric_value,
    thresholdValue: row.threshold_value,
    sampleCount: row.sample_count,
    detail: row.detail,
    measuredAt: row.measured_at,
  }));
}

export async function loadToolRunLogs(
  client: SupabaseClient,
  filters: ToolRunLogFilters = {},
): Promise<readonly ToolRunLogEntry[]> {
  const parsedFilters = toolRunLogFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    throw new AppError({
      code: "INVALID_TOOL_RUN_LOG_FILTER",
      message: "工具审计筛选参数无效",
      status: 400,
      cause: parsedFilters.error,
    });
  }
  const input = parsedFilters.data;
  const result = await client.rpc("search_ai_tool_run_logs", {
    p_limit: input.limit,
    p_status: input.status ?? null,
    p_tool_name: input.toolName ?? null,
  });
  if (result.error) {
    throw new AppError({
      code: "TOOL_RUN_LOG_QUERY_FAILED",
      message: "跨实例工具审计暂时不可用",
      status: 503,
      retryable: true,
      cause: result.error,
    });
  }
  const parsed = z.array(toolRunLogRowSchema).safeParse(result.data);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_TOOL_RUN_LOG_DATA",
      message: "工具审计返回了无效数据",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }
  return parsed.data.map((row) => ({
    id: row.id,
    toolName: row.tool_name,
    status: row.status,
    sourceLabel: row.source_label,
    durationMs: row.duration_ms,
    errorCode: row.error_code,
    requestId: row.request_id,
    createdAt: row.created_at,
  }));
}

export async function loadApiRouteLogs(
  client: SupabaseClient,
  filters: ApiRouteLogFilters = {},
): Promise<readonly ApiRouteLogEntry[]> {
  const parsedFilters = apiRouteLogFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    throw new AppError({
      code: "INVALID_API_ROUTE_LOG_FILTER",
      message: "API 日志筛选参数无效",
      status: 400,
      cause: parsedFilters.error,
    });
  }
  const input = parsedFilters.data;
  const result = await client.rpc("search_api_route_logs", {
    p_limit: input.limit,
    p_method: input.method ?? null,
    p_status_class: input.statusClass ?? null,
  });
  if (result.error) {
    throw new AppError({
      code: "API_ROUTE_LOG_QUERY_FAILED",
      message: "跨实例 API 日志暂时不可用",
      status: 503,
      retryable: true,
      cause: result.error,
    });
  }
  const parsed = z.array(apiRouteLogRowSchema).safeParse(result.data);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_API_ROUTE_LOG_DATA",
      message: "API 日志返回了无效数据",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }
  return parsed.data.map((row) => ({
    id: row.id,
    routeKey: row.route_key,
    method: row.method,
    statusCode: row.status_code,
    durationMs: row.duration_ms,
    requestId: row.request_id,
    errorCode: row.error_code,
    createdAt: row.created_at,
  }));
}
