import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { KnowledgeService } from "@/features/knowledge/types";
import { createRequestKnowledgeService } from "@/features/knowledge/runtime";
import { AppError, toPublicError } from "@/lib/errors";
import { parseServerEnv } from "@/lib/env";

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

function authorized(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
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
    const requestId = crypto.randomUUID();
    try {
      const runtime = await runtimeFactory();
      if (!runtime.adminToken) {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_NOT_CONFIGURED",
          message: "知识索引管理入口尚未配置",
          status: 503,
        });
      }
      if (!authorized(request, runtime.adminToken)) {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_UNAUTHORIZED",
          message: "无权执行知识索引操作",
          status: 401,
        });
      }
      const body = requestSchema.safeParse(await request.json());
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
