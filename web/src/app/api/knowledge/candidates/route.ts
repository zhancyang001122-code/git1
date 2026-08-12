import { z } from "zod";
import { observeRoute } from "@/lib/route-observability";

import {
  knowledgeOpsErrorResponse,
  requireKnowledgeAdmin,
} from "@/features/knowledge-ops/api-utils";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import type { KnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import {
  candidateDraftSchema,
  manualMaterialInputSchema,
  reviewInputSchema,
} from "@/features/knowledge-ops/schemas";
import { readJsonWithLimit } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create_draft"),
      material: manualMaterialInputSchema,
    })
    .strict(),
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
      const requestId = requestIdFor(request);
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
      const requestId = requestIdFor(request);
      try {
        const runtime = await runtimeFactory();
        requireKnowledgeAdmin(request, runtime);
        const parsed = actionSchema.safeParse(
          await readJsonWithLimit(request, 65_536),
        );
        if (!parsed.success) {
          throw new AppError({
            code: "KNOWLEDGE_CANDIDATE_ACTION_INVALID",
            message: "知识候选操作参数无效",
            status: 400,
            cause: parsed.error,
          });
        }
        if (parsed.data.action === "create_draft") {
          const result = await runtime.service.createManualDraft(
            parsed.data.material,
          );
          return Response.json(
            { ...result, isDemo: runtime.mode === "demo" },
            {
              status: 201,
              headers: {
                "cache-control": "no-store",
                "x-request-id": requestId,
              },
            },
          );
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
export const GET = observeRoute("/api/knowledge/candidates", handlers.GET);
export const POST = observeRoute("/api/knowledge/candidates", handlers.POST);
