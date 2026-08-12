import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/features/auth/same-origin";
import {
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
  knowledgeAdminCookieOptions,
} from "@/features/knowledge-ops/admin-session";
import { apiErrorResponse } from "@/lib/api-error-response";
import { requestIdFor } from "@/lib/request-id";

export function createKnowledgeAdminLogoutHandler(
  options: { allowMissingOrigin?: boolean } = {},
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      assertSameOrigin(request, {
        allowMissingOrigin:
          options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
      });
      const secure =
        (request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
          new URL(request.url).protocol.replace(":", "")) === "https";
      const response = new NextResponse(null, {
        status: 303,
        headers: {
          location: "/knowledge-admin/login",
          "cache-control": "no-store",
          "x-request-id": requestId,
        },
      });
      response.cookies.set(KNOWLEDGE_ADMIN_SESSION_COOKIE, "", {
        ...knowledgeAdminCookieOptions(secure),
        maxAge: 0,
      });
      return response;
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const POST = createKnowledgeAdminLogoutHandler();
