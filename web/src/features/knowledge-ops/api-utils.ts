import type { KnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import { isKnowledgeAdminRequestAuthorized } from "@/features/knowledge-ops/admin-session";
import { AppError, toPublicError } from "@/lib/errors";

export function requireKnowledgeAdmin(
  request: Request,
  runtime: Pick<KnowledgeOpsRuntime, "adminToken">,
) {
  if (!runtime.adminToken) {
    throw new AppError({
      code: "KNOWLEDGE_ADMIN_NOT_CONFIGURED",
      message: "知识管理入口尚未配置",
      status: 503,
    });
  }
  if (!isKnowledgeAdminRequestAuthorized(request, runtime.adminToken)) {
    throw new AppError({
      code: "KNOWLEDGE_ADMIN_UNAUTHORIZED",
      message: "无权执行知识管理操作",
      status: 401,
    });
  }
}

export function knowledgeOpsErrorResponse(
  error: unknown,
  requestId: string,
): Response {
  const status = error instanceof AppError ? error.status : 500;
  return Response.json(
    { error: toPublicError(error, requestId) },
    {
      status,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}
