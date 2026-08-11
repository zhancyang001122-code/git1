import { assertSameOrigin } from "@/features/auth/same-origin";
import {
  createPreferencesApiRuntime,
  type PreferencesApiRuntime,
} from "@/features/preferences/runtime";
import { preferencePatchSchema } from "@/features/preferences/schemas";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { readJsonWithLimit } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

export type { PreferencesApiRuntime } from "@/features/preferences/runtime";

function authRequired(): never {
  throw new AppError({
    code: "AUTH_REQUIRED",
    message: "请先登录再管理长期偏好",
    status: 401,
  });
}

export function createPreferencesHandlers(
  runtimeFactory: () => Promise<PreferencesApiRuntime> = createPreferencesApiRuntime,
  options: { allowMissingOrigin?: boolean } = {},
) {
  async function authenticatedRuntime(): Promise<{
    runtime: PreferencesApiRuntime;
    userId: string;
  }> {
    const runtime = await runtimeFactory();
    const userId = await runtime.getAuthenticatedUserId();
    if (!userId) return authRequired();
    return { runtime, userId };
  }

  return {
    async GET(request: Request): Promise<Response> {
      const requestId = requestIdFor(request);
      try {
        const { runtime, userId } = await authenticatedRuntime();
        return Response.json(await runtime.getPreferences(userId), {
          headers: noStoreHeaders(requestId),
        });
      } catch (error) {
        return apiErrorResponse(error, requestId);
      }
    },
    async PATCH(request: Request): Promise<Response> {
      const requestId = requestIdFor(request);
      try {
        assertSameOrigin(request, {
          allowMissingOrigin:
            options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
        });
        const { runtime, userId } = await authenticatedRuntime();
        const parsed = preferencePatchSchema.safeParse(
          await readJsonWithLimit(request, 8_192),
        );
        if (!parsed.success) {
          throw new AppError({
            code: "PREFERENCES_INVALID",
            message: "偏好参数格式无效",
            status: 400,
            cause: parsed.error,
          });
        }
        return Response.json(
          await runtime.patchPreferences(userId, parsed.data),
          { headers: noStoreHeaders(requestId) },
        );
      } catch (error) {
        return apiErrorResponse(error, requestId);
      }
    },
  };
}

const handlers = createPreferencesHandlers();
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
