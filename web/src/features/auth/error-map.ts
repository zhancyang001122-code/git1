import { AppError } from "@/lib/errors";

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

export function mapSupabaseAuthError(error: unknown): AppError {
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
  return new AppError({
    code: "AUTH_UNAVAILABLE",
    message: "登录服务暂时不可用，请稍后重试",
    status: 503,
    retryable: true,
    cause: error,
  });
}
