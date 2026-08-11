import {
  type AuthRuntime,
  createSupabaseAuthRuntime,
} from "@/features/auth/runtime";
import { assertSameOrigin } from "@/features/auth/same-origin";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { requestIdFor } from "@/lib/request-id";

interface SignOutHandlerOptions {
  runtimeFactory?: () => Promise<AuthRuntime>;
  allowMissingOrigin?: boolean;
}

export function createSignOutHandler(options: SignOutHandlerOptions = {}) {
  const runtimeFactory = options.runtimeFactory ?? createSupabaseAuthRuntime;
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      assertSameOrigin(request, {
        allowMissingOrigin:
          options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
      });
      const runtime = await runtimeFactory();
      await runtime.signOut();
      return Response.json(
        { ok: true },
        { headers: noStoreHeaders(requestId) },
      );
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const POST = createSignOutHandler();
