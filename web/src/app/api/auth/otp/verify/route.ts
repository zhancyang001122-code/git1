import {
  type AuthRuntime,
  createSupabaseAuthRuntime,
} from "@/features/auth/runtime";
import { safeNextPath } from "@/features/auth/safe-next";
import { assertSameOrigin } from "@/features/auth/same-origin";
import { otpVerifySchema } from "@/features/auth/schemas";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { readJsonWithLimit } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

interface OtpVerifyHandlerOptions {
  runtimeFactory?: () => Promise<AuthRuntime>;
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
