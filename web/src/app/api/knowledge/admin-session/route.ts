import { NextResponse } from "next/server";

import {
  bearerTokenMatches,
  createKnowledgeAdminSession,
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
  knowledgeAdminCookieOptions,
} from "@/features/knowledge-ops/admin-session";
import { parseServerEnv } from "@/lib/env";
import { requestIdFor } from "@/lib/request-id";

export function createKnowledgeAdminSessionHandler(
  tokenFactory: () => string | undefined = () =>
    parseServerEnv(process.env).DEMO_ADMIN_TOKEN,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    const configuredToken = tokenFactory();
    if (!configuredToken) {
      return Response.json(
        {
          error: {
            code: "KNOWLEDGE_ADMIN_NOT_CONFIGURED",
            message: "知识管理入口尚未配置",
          },
        },
        { status: 503, headers: { "x-request-id": requestId } },
      );
    }
    const form = await request.formData();
    const provided = String(form.get("token") ?? "");
    if (!bearerTokenMatches(`Bearer ${provided}`, configuredToken)) {
      return Response.json(
        {
          error: {
            code: "KNOWLEDGE_ADMIN_UNAUTHORIZED",
            message: "管理口令无效",
          },
        },
        { status: 401, headers: { "x-request-id": requestId } },
      );
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
  };
}

export const POST = createKnowledgeAdminSessionHandler();
