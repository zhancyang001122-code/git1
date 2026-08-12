import {
  type AuthRuntime,
  createSupabaseAuthRuntime,
} from "@/features/auth/runtime";
import { safeNextPath } from "@/features/auth/safe-next";
import { assertSameOrigin } from "@/features/auth/same-origin";
import { DEMO_LOGIN_CODE, demoLoginSchema } from "@/features/auth/schemas";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import { observeRoute } from "@/lib/route-observability";
import {
  createFixedWindowRateLimiter,
  type RateLimitResult,
  requestClientKey,
} from "@/lib/rate-limit";
import { requestIdFor } from "@/lib/request-id";

interface RateLimiter {
  check(key: string): RateLimitResult;
}

interface DemoLoginHandlerOptions {
  runtimeFactory?: () => Promise<AuthRuntime>;
  allowMissingOrigin?: boolean;
  rateLimiter?: RateLimiter;
}

export function createDemoLoginHandler(options: DemoLoginHandlerOptions = {}) {
  const runtimeFactory = options.runtimeFactory ?? createSupabaseAuthRuntime;
  const rateLimiter =
    options.rateLimiter ??
    createFixedWindowRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      assertSameOrigin(request, {
        allowMissingOrigin:
          options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
      });
      const limit = rateLimiter.check(requestClientKey(request));
      if (!limit.allowed) {
        return rateLimitResponse(limit, requestId, {
          code: "AUTH_RATE_LIMITED",
          message: "演示登录请求过于频繁，请稍后再试",
        });
      }
      const parsed = demoLoginSchema.safeParse(
        await readJsonWithLimit(request, 4_096),
      );
      if (!parsed.success || parsed.data.code !== DEMO_LOGIN_CODE) {
        throw new AppError({
          code: "AUTH_DEMO_CODE_INVALID",
          message: "演示码错误",
          status: 400,
        });
      }
      const runtime = await runtimeFactory();
      await runtime.signInDemo();
      return Response.json(
        { ok: true, next: safeNextPath(parsed.data.next) },
        { headers: noStoreHeaders(requestId) },
      );
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const POST = observeRoute(
  "/api/auth/demo-login",
  createDemoLoginHandler(),
);
