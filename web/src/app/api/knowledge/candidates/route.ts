import { z } from "zod";

import {
  knowledgeOpsErrorResponse,
  requireKnowledgeAdmin,
} from "@/features/knowledge-ops/api-utils";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import type { KnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import {
  candidateDraftSchema,
  reviewInputSchema,
} from "@/features/knowledge-ops/schemas";
import { AppError } from "@/lib/errors";

const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("draft"),
      candidateId: z.string().uuid(),
      draft: candidateDraftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("review"),
      review: reviewInputSchema,
    })
    .strict(),
]);

type RuntimeFactory = () => Promise<KnowledgeOpsRuntime>;

export function createKnowledgeCandidatesHandlers(
  runtimeFactory: RuntimeFactory = createKnowledgeOpsRuntime,
) {
  return {
    async GET(request: Request): Promise<Response> {
      const requestId = crypto.randomUUID();
      try {
        const runtime = await runtimeFactory();
        requireKnowledgeAdmin(request, runtime);
        const items = await runtime.service.listCandidates();
        return Response.json(
          { items, isDemo: runtime.mode === "demo" },
          {
            headers: { "cache-control": "no-store", "x-request-id": requestId },
          },
        );
      } catch (error) {
        return knowledgeOpsErrorResponse(error, requestId);
      }
    },

    async POST(request: Request): Promise<Response> {
      const requestId = crypto.randomUUID();
      try {
        const runtime = await runtimeFactory();
        requireKnowledgeAdmin(request, runtime);
        const parsed = actionSchema.safeParse(await request.json());
        if (!parsed.success) {
          throw new AppError({
            code: "KNOWLEDGE_CANDIDATE_ACTION_INVALID",
            message: "知识候选操作参数无效",
            status: 400,
            cause: parsed.error,
          });
        }
        if (parsed.data.action === "draft") {
          const candidate = await runtime.service.draftCandidate(
            parsed.data.candidateId,
            parsed.data.draft,
          );
          return Response.json(
            { candidate, isDemo: runtime.mode === "demo" },
            {
              headers: {
                "cache-control": "no-store",
                "x-request-id": requestId,
              },
            },
          );
        }
        const review = await runtime.service.review(parsed.data.review);
        return Response.json(
          { review, isDemo: runtime.mode === "demo" },
          {
            headers: { "cache-control": "no-store", "x-request-id": requestId },
          },
        );
      } catch (error) {
        return knowledgeOpsErrorResponse(error, requestId);
      }
    },
  };
}

const handlers = createKnowledgeCandidatesHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
