import { AppError } from "@/lib/errors";

type AuthOperation = "send" | "verify" | "sign-out";

function providerDetails(error: unknown): {
  code: string;
  message: string;
  status: number | null;
} {
  if (!error || typeof error !== "object") {
    return { code: "", message: "", status: null };
  }
  const value = error as Record<string, unknown>;
  return {
    code: typeof value.code === "string" ? value.code.toLowerCase() : "",
    message:
      typeof value.message === "string" ? value.message.toLowerCase() : "",
    status: typeof value.status === "number" ? value.status : null,
  };
}

export function isMissingAuthSession(error: unknown): boolean {
  const details = providerDetails(error);
  return (
    details.code.includes("session_not_found") ||
    details.code.includes("session_missing") ||
    details.code.includes("refresh_token_not_found") ||
    details.code.includes("invalid_refresh_token") ||
    details.message.includes("auth session missing") ||
    details.message.includes("refresh token not found")
  );
}

export function mapSupabaseAuthError(
  error: unknown,
  operation: AuthOperation,
): AppError {
  if (error instanceof AppError) return error;
  const details = providerDetails(error);
  if (
    details.status === 429 ||
    details.code.includes("rate_limit") ||
    details.message.includes("rate limit")
  ) {
    return new AppError({
      code: "AUTH_RATE_LIMITED",
      message: "验证码请求过于频繁，请稍后再试",
      status: 429,
      retryable: true,
      cause: error,
    });
  }
  if (
    operation === "send" &&
    (details.code.includes("email_address_invalid") ||
      details.code === "invalid_email" ||
      details.message.includes("invalid email"))
  ) {
    return new AppError({
      code: "AUTH_EMAIL_INVALID",
      message: "邮箱格式无效",
      status: 400,
      cause: error,
    });
  }
  if (
    operation === "verify" &&
    (details.status === 400 ||
      details.status === 401 ||
      details.status === 422 ||
      details.code.includes("otp") ||
      details.code.includes("token"))
  ) {
    return new AppError({
      code: "AUTH_OTP_INVALID",
      message: "验证码错误或已失效",
      status: 400,
      cause: error,
    });
  }
  if (operation === "send") {
    return new AppError({
      code: "AUTH_OTP_SEND_FAILED",
      message: "验证码暂时无法发送，请稍后重试",
      status: 502,
      retryable: true,
      cause: error,
    });
  }
  return new AppError({
    code: "AUTH_UNAVAILABLE",
    message: "登录服务暂时不可用，请稍后重试",
    status: 503,
    retryable: true,
    cause: error,
  });
}
