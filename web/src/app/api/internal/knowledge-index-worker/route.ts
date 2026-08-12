import {
  createKnowledgeIndexWorkerRuntime,
  type KnowledgeIndexWorkerRuntime,
} from "@/features/knowledge-ops/runtime";
import {
  bearerTokenMatches,
  isKnowledgeAdminRequestAuthorized,
} from "@/features/knowledge-ops/admin-session";
import { AppError, toPublicError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";
import { observeRoute } from "@/lib/route-observability";
import { rateLimitResponse } from "@/lib/api-security";
import {
  createFixedWindowRateLimiter,
  requestClientKey,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const workerRateLimiter = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60_000,
});

type RuntimeFactory = () => Promise<KnowledgeIndexWorkerRuntime>;

function errorResponse(error: unknown, requestId: string): Response {
  const normalized = toPublicError(error, requestId);
  return Response.json(
    { error: normalized },
    {
      status: error instanceof AppError ? error.status : 500,
      headers: {
        "cache-control": "no-store",
        "x-error-code": normalized.code,
        "x-request-id": requestId,
      },
    },
  );
}

function isAuthorized(
  request: Request,
  runtime: KnowledgeIndexWorkerRuntime,
): boolean {
  return Boolean(
    (runtime.cronSecret &&
      bearerTokenMatches(
        request.headers.get("authorization"),
        runtime.cronSecret,
      )) ||
    (runtime.adminToken &&
      isKnowledgeAdminRequestAuthorized(request, runtime.adminToken)),
  );
}

export function createKnowledgeIndexWorkerHandler(
  runtimeFactory: RuntimeFactory = createKnowledgeIndexWorkerRuntime,
) {
  return async function handle(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const rateLimit = workerRateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit, requestId);
      const runtime = await runtimeFactory();
      if (!runtime.cronSecret && !runtime.adminToken) {
        throw new AppError({
          code: "KNOWLEDGE_INDEX_WORKER_AUTH_NOT_CONFIGURED",
          message: "知识索引 Worker 尚未配置访问凭证",
          status: 503,
        });
      }
      if (!isAuthorized(request, runtime)) {
        throw new AppError({
          code: "KNOWLEDGE_INDEX_WORKER_UNAUTHORIZED",
          message: "无权触发知识索引 Worker",
          status: 401,
        });
      }
      const result = await runtime.worker.runOne(
        crypto.randomUUID(),
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

const handle = createKnowledgeIndexWorkerHandler();

export const GET = observeRoute("/api/internal/knowledge-index-worker", handle);
export const POST = observeRoute(
  "/api/internal/knowledge-index-worker",
  handle,
);
