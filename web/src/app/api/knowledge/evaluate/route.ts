import { z } from "zod";

import {
  knowledgeOpsErrorResponse,
  requireKnowledgeAdmin,
} from "@/features/knowledge-ops/api-utils";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import type { KnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

const requestSchema = z.object({ candidateId: z.string().uuid() }).strict();

export function createKnowledgeEvaluateHandler(
  runtimeFactory: () => Promise<KnowledgeOpsRuntime> = createKnowledgeOpsRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const runtime = await runtimeFactory();
      requireKnowledgeAdmin(request, runtime);
      const parsed = requestSchema.safeParse(await request.json());
      if (!parsed.success) {
        throw new AppError({
          code: "KNOWLEDGE_EVALUATE_INPUT_INVALID",
          message: "知识评测参数无效",
          status: 400,
          cause: parsed.error,
        });
      }
      const result = await runtime.service.evaluate(parsed.data.candidateId);
      return Response.json(
        { ...result, isDemo: runtime.mode === "demo" },
        {
          headers: { "cache-control": "no-store", "x-request-id": requestId },
        },
      );
    } catch (error) {
      return knowledgeOpsErrorResponse(error, requestId);
    }
  };
}

export const POST = createKnowledgeEvaluateHandler();
