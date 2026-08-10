import { z } from "zod";

import type { KnowledgeService } from "@/features/knowledge/types";
import { createRequestKnowledgeService } from "@/features/knowledge/runtime";
import { isKnowledgeAdminRequestAuthorized } from "@/features/knowledge-ops/admin-session";
import { AppError, toPublicError } from "@/lib/errors";
import { parseServerEnv } from "@/lib/env";
import { requestIdFor } from "@/lib/request-id";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import {
  createFixedWindowRateLimiter,
  requestClientKey,
} from "@/lib/rate-limit";

const indexRateLimiter = createFixedWindowRateLimiter({
  limit: 20,
  windowMs: 60_000,
});

const requestSchema = z.object({ versionId: z.string().uuid() }).strict();

interface IndexRuntime {
  service: KnowledgeService;
  adminToken: string | undefined;
}

type RuntimeFactory = () => Promise<IndexRuntime>;

async function defaultRuntime(): Promise<IndexRuntime> {
  return {
    service: await createRequestKnowledgeService(),
    adminToken: parseServerEnv(process.env).DEMO_ADMIN_TOKEN,
  };
}

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

export function createKnowledgeIndexHandler(
  runtimeFactory: RuntimeFactory = defaultRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const rateLimit = indexRateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit, requestId);
      const runtime = await runtimeFactory();
      if (!runtime.adminToken) {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_NOT_CONFIGURED",
          message: "知识索引管理入口尚未配置",
          status: 503,
        });
      }
      if (!isKnowledgeAdminRequestAuthorized(request, runtime.adminToken)) {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_UNAUTHORIZED",
          message: "无权执行知识索引操作",
          status: 401,
        });
      }
      const body = requestSchema.safeParse(
        await readJsonWithLimit(request, 4_096),
      );
      if (!body.success) {
        throw new AppError({
          code: "KNOWLEDGE_INDEX_INPUT_INVALID",
          message: "知识索引参数格式无效",
          status: 400,
          cause: body.error,
        });
      }
      const result = await runtime.service.indexVersion(
        body.data.versionId,
        request.signal,
      );
      return Response.json(result, {
        headers: { "cache-control": "no-store", "x-request-id": requestId },
      });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export const POST = createKnowledgeIndexHandler();
