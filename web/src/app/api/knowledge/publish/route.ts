import {
  knowledgeOpsErrorResponse,
  requireKnowledgeAdmin,
} from "@/features/knowledge-ops/api-utils";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import type { KnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import { publishInputSchema } from "@/features/knowledge-ops/schemas";
import { AppError } from "@/lib/errors";

export function createKnowledgePublishHandler(
  runtimeFactory: () => Promise<KnowledgeOpsRuntime> = createKnowledgeOpsRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID();
    try {
      const runtime = await runtimeFactory();
      requireKnowledgeAdmin(request, runtime);
      const parsed = publishInputSchema.safeParse(await request.json());
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

export const POST = createKnowledgePublishHandler();
