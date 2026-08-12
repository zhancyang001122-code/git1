import { z } from "zod";

import {
  createSupabaseIncidentRepository,
  type IncidentRepository,
} from "@/features/ai-ops/incidents";
import { requireKnowledgeAdmin } from "@/features/knowledge-ops/api-utils";
import { readJsonWithLimit } from "@/lib/api-security";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { parseServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { observeRoute } from "@/lib/route-observability";
import { requestIdFor } from "@/lib/request-id";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const actionSchema = z
  .object({
    incidentId: z.string().uuid(),
    action: z.enum(["acknowledge", "resolve"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "resolve" && !value.note) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "解决事故必须填写处理说明",
      });
    }
  });

interface IncidentRuntime {
  repository: IncidentRepository;
  adminToken: string | undefined;
}

async function defaultRuntime(): Promise<IncidentRuntime> {
  return {
    repository: createSupabaseIncidentRepository(createAdminSupabaseClient()),
    adminToken: parseServerEnv(process.env).DEMO_ADMIN_TOKEN,
  };
}

export function createIncidentHandlers(
  runtimeFactory: () => Promise<IncidentRuntime> = defaultRuntime,
) {
  return {
    async GET(request: Request): Promise<Response> {
      const requestId = requestIdFor(request);
      try {
        const runtime = await runtimeFactory();
        requireKnowledgeAdmin(request, runtime);
        return Response.json(
          { incidents: await runtime.repository.list(20) },
          { headers: noStoreHeaders(requestId) },
        );
      } catch (error) {
        return apiErrorResponse(error, requestId);
      }
    },

    async POST(request: Request): Promise<Response> {
      const requestId = requestIdFor(request);
      try {
        const runtime = await runtimeFactory();
        requireKnowledgeAdmin(request, runtime);
        const parsed = actionSchema.safeParse(
          await readJsonWithLimit(request, 4_096),
        );
        if (!parsed.success) {
          throw new AppError({
            code: "INVALID_INCIDENT_ACTION",
            message: "事故操作参数无效",
            status: 400,
            cause: parsed.error,
          });
        }
        return Response.json(
          {
            incident: await runtime.repository.transition({
              incidentId: parsed.data.incidentId,
              action: parsed.data.action,
              actorLabel: "portfolio_admin",
              note: parsed.data.note ?? null,
            }),
          },
          { headers: noStoreHeaders(requestId) },
        );
      } catch (error) {
        return apiErrorResponse(error, requestId);
      }
    },
  };
}

const handlers = createIncidentHandlers();
export const GET = observeRoute("/api/knowledge/incidents", handlers.GET);
export const POST = observeRoute("/api/knowledge/incidents", handlers.POST);
