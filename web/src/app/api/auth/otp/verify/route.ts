import {
  type AuthRuntime,
  createSupabaseAuthRuntime,
} from "@/features/auth/runtime";
import { assertAllowedAuthEmail } from "@/features/auth/access-policy";
import { safeNextPath } from "@/features/auth/safe-next";
import { assertSameOrigin } from "@/features/auth/same-origin";
import { otpVerifySchema } from "@/features/auth/schemas";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { readJsonWithLimit } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";
import { serverEnv } from "@/lib/env";

interface OtpVerifyHandlerOptions {
  runtimeFactory?: () => Promise<AuthRuntime>;
  allowedEmail?: string | null;
  production?: boolean;
  allowMissingOrigin?: boolean;
}

export function createOtpVerifyHandler(options: OtpVerifyHandlerOptions = {}) {
  const runtimeFactory = options.runtimeFactory ?? createSupabaseAuthRuntime;
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      assertSameOrigin(request, {
        allowMissingOrigin:
          options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
      });
      const parsed = otpVerifySchema.safeParse(
        await readJsonWithLimit(request, 8_192),
      );
      if (!parsed.success) {
        const emailIssue = parsed.error.issues.some(
          (issue) => issue.path[0] === "email",
        );
        throw new AppError({
          code: emailIssue ? "AUTH_EMAIL_INVALID" : "AUTH_OTP_INVALID",
          message: emailIssue ? "邮箱格式无效" : "验证码错误或已失效",
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
      const runtime = await runtimeFactory();
      await runtime.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.token,
      });
      return Response.json(
        { ok: true, next: safeNextPath(parsed.data.next) },
        { headers: noStoreHeaders(requestId) },
      );
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}

export const POST = createOtpVerifyHandler();
