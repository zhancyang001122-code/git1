import { z } from "zod";

import { knowledgeDomains } from "@/features/knowledge/types";
import type { KnowledgeService } from "@/features/knowledge/types";
import { createRequestKnowledgeService } from "@/features/knowledge/runtime";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import { createEnvironmentFixedWindowRateLimiter } from "@/lib/distributed-rate-limit";
import { AppError, toPublicError } from "@/lib/errors";
import { requestClientKey, type RateLimiter } from "@/lib/rate-limit";
import { requestIdFor } from "@/lib/request-id";
import { observeRoute } from "@/lib/route-observability";

const knowledgeSearchRateLimiter = createEnvironmentFixedWindowRateLimiter({
  scope: "knowledge_search_ip",
  limit: 30,
  windowMs: 60_000,
});

const requestSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    domain: z.enum(knowledgeDomains).nullable().default(null),
    category: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,79}$/)
      .nullable()
      .default(null),
    city: z.string().trim().min(1).max(40).nullable().default(null),
    topK: z.number().int().min(1).max(8).default(5),
  })
  .strict();

type RuntimeFactory = () => Promise<KnowledgeService>;

function errorResponse(error: unknown, requestId: string): Response {
  const status = error instanceof AppError ? error.status : 500;
  const normalized = toPublicError(error, requestId);
  return Response.json(
    { error: normalized },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-error-code": normalized.code,
        "x-request-id": requestId,
      },
    },
  );
}

export function createKnowledgeSearchHandler(
  runtimeFactory: RuntimeFactory = () => createRequestKnowledgeService(),
  rateLimiter: RateLimiter = knowledgeSearchRateLimiter,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const rateLimit = await rateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit, requestId);
      const body = requestSchema.safeParse(
        await readJsonWithLimit(request, 8_192),
      );
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

export const POST = observeRoute(
  "/api/knowledge/search",
  createKnowledgeSearchHandler(),
);
