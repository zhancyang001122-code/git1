import { z } from "zod";

import { knowledgeDomains } from "@/features/knowledge/types";
import type { KnowledgeService } from "@/features/knowledge/types";
import { createRequestKnowledgeService } from "@/features/knowledge/runtime";
import { AppError, toPublicError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

const requestSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    domain: z.enum(knowledgeDomains).nullable().default(null),
    category: z.string().trim().min(1).max(80).nullable().default(null),
    city: z.string().trim().min(1).max(40).nullable().default(null),
    topK: z.number().int().min(1).max(8).default(5),
  })
  .strict();

type RuntimeFactory = () => Promise<KnowledgeService>;

function errorResponse(error: unknown, requestId: string): Response {
  const status = error instanceof AppError ? error.status : 500;
  return Response.json(
    { error: toPublicError(error, requestId) },
    {
      status,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}

export function createKnowledgeSearchHandler(
  runtimeFactory: RuntimeFactory = () => createRequestKnowledgeService(),
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const body = requestSchema.safeParse(await request.json());
      if (!body.success) {
        throw new AppError({
          code: "KNOWLEDGE_SEARCH_INPUT_INVALID",
          message: "知识检索参数格式无效",
          status: 400,
          cause: body.error,
        });
      }
      const service = await runtimeFactory();
      const result = await service.search(body.data, request.signal);
      return Response.json(result, {
        headers: { "cache-control": "no-store", "x-request-id": requestId },
      });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export const POST = createKnowledgeSearchHandler();
