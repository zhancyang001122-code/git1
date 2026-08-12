import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/features/auth/same-origin";
import {
  bearerTokenMatches,
  createKnowledgeAdminSession,
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
  knowledgeAdminCookieOptions,
} from "@/features/knowledge-ops/admin-session";
import { apiErrorResponse } from "@/lib/api-error-response";
import { observeRoute } from "@/lib/route-observability";
import { readTextWithLimit } from "@/lib/api-security";
import { parseServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

export function createKnowledgeAdminSessionHandler(
  tokenFactory: () => string | undefined = () =>
    parseServerEnv(process.env).DEMO_ADMIN_TOKEN,
  options: { allowMissingOrigin?: boolean } = {},
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      assertSameOrigin(request, {
        allowMissingOrigin:
          options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
      });
      const configuredToken = tokenFactory();
      if (!configuredToken) {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_NOT_CONFIGURED",
          message: "知识管理入口尚未配置",
          status: 503,
        });
      }
      const contentType = request.headers.get("content-type")?.split(";", 1)[0];
      if (contentType !== "application/x-www-form-urlencoded") {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_CONTENT_TYPE_INVALID",
          message: "管理登录请求格式无效",
          status: 415,
        });
      }
      const text = await readTextWithLimit(request, 4_096);
      const provided = new URLSearchParams(text).get("token") ?? "";
      if (!bearerTokenMatches(`Bearer ${provided}`, configuredToken)) {
        throw new AppError({
          code: "KNOWLEDGE_ADMIN_UNAUTHORIZED",
          message: "管理口令无效",
          status: 401,
        });
      }
      const response = new NextResponse(null, {
        status: 303,
        headers: { location: "/knowledge-admin", "x-request-id": requestId },
      });
      response.cookies.set(
        KNOWLEDGE_ADMIN_SESSION_COOKIE,
        createKnowledgeAdminSession(configuredToken),
        knowledgeAdminCookieOptions(
          (request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
            new URL(request.url).protocol.replace(":", "")) === "https",
        ),
      );
      return response;
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const POST = observeRoute(
  "/api/knowledge/admin-session",
  createKnowledgeAdminSessionHandler(),
);
