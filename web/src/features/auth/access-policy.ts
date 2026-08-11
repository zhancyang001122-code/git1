import { AppError } from "@/lib/errors";

interface AuthAccessPolicyOptions {
  allowedEmail?: string;
  production: boolean;
}

export function assertAllowedAuthEmail(
  email: string,
  { allowedEmail, production }: AuthAccessPolicyOptions,
): void {
  if (!allowedEmail) {
    if (!production) return;
    throw new AppError({
      code: "AUTH_UNAVAILABLE",
      message: "演示登录尚未配置，请联系作品作者",
      status: 503,
      retryable: true,
    });
  }

  if (email !== allowedEmail) {
    throw new AppError({
      code: "AUTH_EMAIL_NOT_ALLOWED",
      message: "该邮箱未开放演示登录",
      status: 403,
    });
  }
}
