import {
  type AuthRuntime,
  createSupabaseAuthRuntime,
} from "@/features/auth/runtime";
import { assertAllowedAuthEmail } from "@/features/auth/access-policy";
import { assertSameOrigin } from "@/features/auth/same-origin";
import { otpSendSchema } from "@/features/auth/schemas";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import {
  createFixedWindowRateLimiter,
  type RateLimitResult,
  requestClientKey,
} from "@/lib/rate-limit";
import { requestIdFor } from "@/lib/request-id";
import { serverEnv } from "@/lib/env";

interface RateLimiter {
  check(key: string): RateLimitResult;
}

interface OtpSendHandlerOptions {
  runtimeFactory?: () => Promise<AuthRuntime>;
  allowedEmail?: string | null;
  production?: boolean;
  allowMissingOrigin?: boolean;
  rateLimiters?: { client: RateLimiter; email: RateLimiter };
}

export function createOtpSendHandler(options: OtpSendHandlerOptions = {}) {
  const clientLimiter =
    options.rateLimiters?.client ??
    createFixedWindowRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
  const emailLimiter =
    options.rateLimiters?.email ??
    createFixedWindowRateLimiter({ limit: 3, windowMs: 10 * 60_000 });
  const runtimeFactory = options.runtimeFactory ?? createSupabaseAuthRuntime;

  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      assertSameOrigin(request, {
        allowMissingOrigin:
          options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
      });
      const clientLimit = clientLimiter.check(requestClientKey(request));
      if (!clientLimit.allowed) {
        return rateLimitResponse(clientLimit, requestId, {
          code: "AUTH_RATE_LIMITED",
          message: "验证码请求过于频繁，请稍后再试",
        });
      }
      const parsed = otpSendSchema.safeParse(
        await readJsonWithLimit(request, 8_192),
      );
      if (!parsed.success) {
        throw new AppError({
          code: "AUTH_EMAIL_INVALID",
          message: "邮箱格式无效",
          status: 400,
          cause: parsed.error,
        });
      }
      assertAllowedAuthEmail(parsed.data.email, {
        allowedEmail:
          options.allowedEmail === undefined
            ? serverEnv().AUTH_ALLOWED_EMAIL
            : (options.allowedEmail ?? undefined),
        production: options.production ?? process.env.NODE_ENV === "production",
      });
      const emailLimit = emailLimiter.check(`email:${parsed.data.email}`);
      if (!emailLimit.allowed) {
        return rateLimitResponse(emailLimit, requestId, {
          code: "AUTH_RATE_LIMITED",
          message: "验证码请求过于频繁，请稍后再试",
        });
      }
      const runtime = await runtimeFactory();
      await runtime.sendOtp(parsed.data);
      return Response.json(
        { ok: true },
        { headers: noStoreHeaders(requestId) },
      );
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const POST = createOtpSendHandler();
