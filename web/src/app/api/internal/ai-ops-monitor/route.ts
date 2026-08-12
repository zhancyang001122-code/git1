import {
  bearerTokenMatches,
  isKnowledgeAdminRequestAuthorized,
} from "@/features/knowledge-ops/admin-session";
import {
  createSupabaseIncidentRepository,
  type IncidentRepository,
} from "@/features/ai-ops/incidents";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { parseServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { observeRoute } from "@/lib/route-observability";
import { requestIdFor } from "@/lib/request-id";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface MonitorRuntime {
  repository: IncidentRepository;
  cronSecret?: string;
  adminToken?: string;
}

async function defaultRuntime(): Promise<MonitorRuntime> {
  const environment = parseServerEnv(process.env);
  return {
    repository: createSupabaseIncidentRepository(createAdminSupabaseClient()),
    cronSecret: environment.CRON_SECRET,
    adminToken: environment.DEMO_ADMIN_TOKEN,
  };
}

function authorized(request: Request, runtime: MonitorRuntime): boolean {
  return Boolean(
    (runtime.cronSecret &&
      bearerTokenMatches(
        request.headers.get("authorization"),
        runtime.cronSecret,
      )) ||
    (runtime.adminToken &&
      isKnowledgeAdminRequestAuthorized(request, runtime.adminToken)),
  );
}

export function createAiOpsMonitorHandler(
  runtimeFactory: () => Promise<MonitorRuntime> = defaultRuntime,
) {
  return async function GET(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const runtime = await runtimeFactory();
      if (!runtime.cronSecret && !runtime.adminToken) {
        throw new AppError({
          code: "AI_OPS_MONITOR_AUTH_NOT_CONFIGURED",
          message: "事故监控尚未配置访问凭证",
          status: 503,
        });
      }
      if (!authorized(request, runtime)) {
        throw new AppError({
          code: "AI_OPS_MONITOR_UNAUTHORIZED",
          message: "无权触发事故监控",
          status: 401,
        });
      }
      return Response.json(await runtime.repository.sync(24), {
        headers: noStoreHeaders(requestId),
      });
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const GET = observeRoute(
  "/api/internal/ai-ops-monitor",
  createAiOpsMonitorHandler(),
);
