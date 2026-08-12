import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const uuidSchema = z.string().uuid();
const routeLogInputSchema = z
  .object({
    routeKey: z.string().regex(/^\/api\/[a-z0-9_\-/[\]]{1,180}$/),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    statusCode: z.number().int().min(100).max(599),
    durationMs: z.number().int().min(0).max(300_000),
    requestId: uuidSchema,
    errorCode: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{1,119}$/)
      .nullable(),
  })
  .strict();

export type RouteLogInput = z.infer<typeof routeLogInputSchema>;

export interface RouteLogRepository {
  record(input: RouteLogInput): Promise<void>;
}

export function createSupabaseRouteLogRepository(
  client: SupabaseClient,
): RouteLogRepository {
  return {
    async record(input) {
      const parsed = routeLogInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new AppError({
          code: "INVALID_ROUTE_LOG_INPUT",
          message: "路由审计参数无效",
          cause: parsed.error,
        });
      }
      const value = parsed.data;
      const result = await client.from("api_route_logs").insert({
        route_key: value.routeKey,
        method: value.method,
        status_code: value.statusCode,
        duration_ms: value.durationMs,
        request_id: value.requestId,
        error_code: value.errorCode,
      });
      if (result.error) {
        throw new AppError({
          code: "ROUTE_LOG_QUERY_FAILED",
          message: "路由审计暂时不可用",
          retryable: true,
          cause: result.error,
        });
      }
    },
  };
}
