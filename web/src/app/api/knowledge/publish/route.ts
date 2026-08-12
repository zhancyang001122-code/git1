import {
  knowledgeOpsErrorResponse,
  requireKnowledgeAdmin,
} from "@/features/knowledge-ops/api-utils";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import type { KnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import { publishInputSchema } from "@/features/knowledge-ops/schemas";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";
import { observeRoute } from "@/lib/route-observability";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import {
  createFixedWindowRateLimiter,
  requestClientKey,
} from "@/lib/rate-limit";

const publishRateLimiter = createFixedWindowRateLimiter({
  limit: 20,
  windowMs: 60_000,
});

export function createKnowledgePublishHandler(
  runtimeFactory: () => Promise<KnowledgeOpsRuntime> = createKnowledgeOpsRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const rateLimit = publishRateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit, requestId);
      const runtime = await runtimeFactory();
      requireKnowledgeAdmin(request, runtime);
      const parsed = publishInputSchema.safeParse(
        await readJsonWithLimit(request, 4_096),
      );
      if (!parsed.success) {
        throw new AppError({
          code: "KNOWLEDGE_PUBLISH_INPUT_INVALID",
          message: "知识发布参数无效",
          status: 400,
          cause: parsed.error,
        });
      }
      const result = await runtime.service.publish(parsed.data);
      return Response.json(result, {
        headers: { "cache-control": "no-store", "x-request-id": requestId },
      });
    } catch (error) {
      return knowledgeOpsErrorResponse(error, requestId);
    }
  };
}

export const POST = observeRoute(
  "/api/knowledge/publish",
  createKnowledgePublishHandler(),
);
