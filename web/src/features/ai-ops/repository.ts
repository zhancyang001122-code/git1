import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const limitedJson = z.unknown().refine((value) => {
  try {
    const serialized = JSON.stringify(value);
    return serialized !== undefined && serialized.length <= 4096;
  } catch {
    return false;
  }
}, "结构化载荷必须是小于 4KB 的 JSON");
const toolStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "timed_out",
]);
const recordToolRunSchema = z
  .object({
    sessionId: uuid.nullable().optional(),
    messageId: uuid.nullable().optional(),
    toolName: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    status: toolStatus,
    input: limitedJson,
    outputSummary: limitedJson.nullable().optional(),
    sourceLabel: z.string().trim().max(120).nullable().optional(),
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .max(300_000)
      .nullable()
      .optional(),
    errorCode: z.string().trim().max(120).nullable().optional(),
    requestId: uuid,
    startedAt: z.string().datetime({ offset: true }).nullable().optional(),
    completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();
const feedbackReason = z.enum([
  "incorrect",
  "not_relevant",
  "missing_source",
  "unsafe",
  "outdated",
  "other",
]);
const feedbackSchema = z
  .object({
    userId: uuid.nullable(),
    sessionId: uuid,
    messageId: uuid,
    rating: z.enum(["up", "down"]),
    reason: feedbackReason.nullable().optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

const toolRunRowSchema = z.object({
  id: uuid,
  session_id: uuid.nullable(),
  message_id: uuid.nullable(),
  tool_name: z.string(),
  status: toolStatus,
  input_json: z.unknown(),
  output_summary: z.unknown().nullable(),
  source_label: z.string().nullable(),
  duration_ms: z.number().int().nullable(),
  error_code: z.string().nullable(),
  request_id: uuid,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});
const feedbackRowSchema = z.object({
  id: uuid,
  user_id: uuid.nullable(),
  session_id: uuid,
  message_id: uuid,
  rating: z.enum(["up", "down"]),
  reason: feedbackReason.nullable(),
  comment: z.string().nullable(),
  created_at: z.string(),
});

const TOOL_RUN_COLUMNS =
  "id,session_id,message_id,tool_name,status,input_json,output_summary,source_label,duration_ms,error_code,request_id,started_at,completed_at,created_at";
const FEEDBACK_COLUMNS =
  "id,user_id,session_id,message_id,rating,reason,comment,created_at";

export type ToolRunRecord = z.infer<typeof toolRunRowSchema>;
export type FeedbackRecord = z.infer<typeof feedbackRowSchema>;
export interface AIOpsRepository {
  recordToolRun(
    input: z.input<typeof recordToolRunSchema>,
  ): Promise<ToolRunRecord>;
  upsertFeedback(
    input: z.input<typeof feedbackSchema>,
  ): Promise<FeedbackRecord>;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError({
      code: "INVALID_AI_OPS_INPUT",
      message: "AI 运维参数无效",
      cause: result.error,
    });
  return result.data;
}

function mapRow<T>(schema: z.ZodType<T>, row: unknown, label: string): T {
  const result = schema.safeParse(row);
  if (!result.success)
    throw new AppError({
      code: "DATA_CONTRACT_INVALID",
      message: `${label}数据格式无效`,
      cause: result.error,
    });
  return result.data;
}

function queryFailed(cause: unknown): never {
  throw new AppError({
    code: "SUPABASE_QUERY_FAILED",
    message: "AI 运维记录暂时不可用",
    retryable: true,
    cause,
  });
}

export function createSupabaseAIOpsRepository(
  client: SupabaseClient,
): AIOpsRepository {
  return {
    async recordToolRun(input) {
      const value = parse(recordToolRunSchema, input);
      const result = await client
        .from("ai_tool_runs")
        .insert({
          session_id: value.sessionId ?? null,
          message_id: value.messageId ?? null,
          tool_name: value.toolName,
          status: value.status,
          input_json: value.input,
          output_summary: value.outputSummary ?? null,
          source_label: value.sourceLabel ?? null,
          duration_ms: value.durationMs ?? null,
          error_code: value.errorCode ?? null,
          request_id: value.requestId,
          started_at: value.startedAt ?? null,
          completed_at: value.completedAt ?? null,
        })
        .select(TOOL_RUN_COLUMNS)
        .single();
      if (result.error) queryFailed(result.error);
      return mapRow(toolRunRowSchema, result.data, "工具调用");
    },

    async upsertFeedback(input) {
      const value = parse(feedbackSchema, input);
      const result = await client
        .from("ai_feedback")
        .upsert(
          {
            user_id: value.userId,
            session_id: value.sessionId,
            message_id: value.messageId,
            rating: value.rating,
            reason: value.reason ?? null,
            comment: value.comment ?? null,
          },
          { onConflict: "message_id" },
        )
        .select(FEEDBACK_COLUMNS)
        .single();
      if (result.error) queryFailed(result.error);
      return mapRow(feedbackRowSchema, result.data, "反馈");
    },
  };
}
