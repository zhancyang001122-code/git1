import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const uuidSchema = z.string().uuid();
const alertKeySchema = z.enum([
  "tool_failure_rate",
  "rag_no_result_rate",
  "knowledge_index_backlog",
  "rag_eval_failure_rate",
  "first_token_p95",
  "session_cost",
]);
const severitySchema = z.enum(["warning", "critical"]);
const incidentStatusSchema = z.enum(["open", "acknowledged", "resolved"]);
const actorLabelSchema = z.string().regex(/^[a-z][a-z0-9_-]{2,79}$/);
const incidentRowSchema = z.object({
  id: uuidSchema,
  alert_key: alertKeySchema,
  severity: severitySchema,
  status: incidentStatusSchema,
  title: z.string().min(1).max(80),
  metric_value: z.coerce.number().finite().nonnegative(),
  threshold_value: z.coerce.number().finite().nonnegative(),
  sample_count: z.coerce.number().int().nonnegative(),
  detail: z.string().min(1).max(240),
  opened_at: z.string().datetime({ offset: true }),
  last_seen_at: z.string().datetime({ offset: true }),
  acknowledged_at: z.string().datetime({ offset: true }).nullable(),
  acknowledged_by: actorLabelSchema.nullable(),
  resolved_at: z.string().datetime({ offset: true }).nullable(),
  resolution_note: z.string().min(1).max(500).nullable(),
  event_count: z.coerce.number().int().nonnegative().optional(),
  updated_at: z.string().datetime({ offset: true }),
});
const syncRowSchema = z.object({
  opened_count: z.coerce.number().int().nonnegative(),
  refreshed_count: z.coerce.number().int().nonnegative(),
  recovered_count: z.coerce.number().int().nonnegative(),
  active_count: z.coerce.number().int().nonnegative(),
  measured_at: z.string().datetime({ offset: true }),
});
const transitionInputSchema = z
  .object({
    incidentId: uuidSchema,
    action: z.enum(["acknowledge", "resolve"]),
    actorLabel: actorLabelSchema,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "resolve" && !value.note?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "解决事故必须填写处理说明",
      });
    }
  });

export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export interface IncidentRecord {
  id: string;
  alertKey: z.infer<typeof alertKeySchema>;
  severity: z.infer<typeof severitySchema>;
  status: IncidentStatus;
  title: string;
  metricValue: number;
  thresholdValue: number;
  sampleCount: number;
  detail: string;
  openedAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  eventCount: number;
  updatedAt: string;
}
export interface IncidentSyncResult {
  openedCount: number;
  refreshedCount: number;
  recoveredCount: number;
  activeCount: number;
  measuredAt: string;
}
export interface IncidentRepository {
  sync(windowHours?: number): Promise<IncidentSyncResult>;
  list(limit?: number): Promise<readonly IncidentRecord[]>;
  transition(
    input: z.input<typeof transitionInputSchema>,
  ): Promise<IncidentRecord>;
}

function queryFailed(cause: unknown): never {
  throw new AppError({
    code: "AI_OPS_INCIDENT_QUERY_FAILED",
    message: "事故管理暂时不可用",
    status: 503,
    retryable: true,
    cause,
  });
}

function transitionFailed(cause: unknown): never {
  const databaseCode =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String(cause.code)
      : null;
  if (databaseCode === "P0002") {
    throw new AppError({
      code: "AI_OPS_INCIDENT_NOT_FOUND",
      message: "事故记录不存在或已被移除",
      status: 404,
      cause,
    });
  }
  if (databaseCode === "22023") {
    throw new AppError({
      code: "INVALID_INCIDENT_STATE",
      message: "事故状态已变化，请刷新后重试",
      status: 409,
      cause,
    });
  }
  queryFailed(cause);
}

function parseIncident(input: unknown): IncidentRecord {
  const parsed = incidentRowSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_AI_OPS_INCIDENT_DATA",
      message: "事故记录返回了无效数据",
      status: 502,
      cause: parsed.error,
    });
  }
  const row = parsed.data;
  return {
    id: row.id,
    alertKey: row.alert_key,
    severity: row.severity,
    status: row.status,
    title: row.title,
    metricValue: row.metric_value,
    thresholdValue: row.threshold_value,
    sampleCount: row.sample_count,
    detail: row.detail,
    openedAt: row.opened_at,
    lastSeenAt: row.last_seen_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    eventCount: row.event_count ?? 0,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseIncidentRepository(
  client: SupabaseClient,
): IncidentRepository {
  return {
    async sync(windowHours = 24) {
      const parsedWindow = z
        .number()
        .int()
        .min(1)
        .max(720)
        .safeParse(windowHours);
      if (!parsedWindow.success) {
        throw new AppError({
          code: "INVALID_INCIDENT_SYNC_WINDOW",
          message: "事故监控窗口必须是 1 至 720 小时",
          status: 400,
          cause: parsedWindow.error,
        });
      }
      const result = await client
        .rpc("sync_ai_ops_incidents", { p_window_hours: parsedWindow.data })
        .single();
      if (result.error) queryFailed(result.error);
      const parsed = syncRowSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new AppError({
          code: "INVALID_INCIDENT_SYNC_DATA",
          message: "事故同步返回了无效数据",
          status: 502,
          cause: parsed.error,
        });
      }
      return {
        openedCount: parsed.data.opened_count,
        refreshedCount: parsed.data.refreshed_count,
        recoveredCount: parsed.data.recovered_count,
        activeCount: parsed.data.active_count,
        measuredAt: parsed.data.measured_at,
      };
    },

    async list(limit = 20) {
      const parsedLimit = z.number().int().min(1).max(50).safeParse(limit);
      if (!parsedLimit.success) {
        throw new AppError({
          code: "INVALID_INCIDENT_LIST_LIMIT",
          message: "事故列表数量必须是 1 至 50",
          status: 400,
          cause: parsedLimit.error,
        });
      }
      const result = await client.rpc("search_ai_ops_incidents", {
        p_limit: parsedLimit.data,
      });
      if (result.error) queryFailed(result.error);
      const rows = z.array(z.unknown()).safeParse(result.data);
      if (!rows.success) {
        throw new AppError({
          code: "INVALID_AI_OPS_INCIDENT_DATA",
          message: "事故列表返回了无效数据",
          status: 502,
          cause: rows.error,
        });
      }
      return rows.data.map(parseIncident);
    },

    async transition(input) {
      const parsed = transitionInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new AppError({
          code: "INVALID_INCIDENT_TRANSITION",
          message: "事故操作参数无效",
          status: 400,
          cause: parsed.error,
        });
      }
      const value = parsed.data;
      const result = await client
        .rpc("transition_ai_ops_incident", {
          p_incident_id: value.incidentId,
          p_action: value.action,
          p_actor_label: value.actorLabel,
          p_note: value.note?.trim() || null,
        })
        .single();
      if (result.error) transitionFailed(result.error);
      return parseIncident(result.data);
    },
  };
}
