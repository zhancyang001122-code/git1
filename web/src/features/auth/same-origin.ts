import { AppError } from "@/lib/errors";

function invalidOrigin(cause?: unknown): never {
  throw new AppError({
    code: "AUTH_ORIGIN_INVALID",
    message: "请求来源无效",
    status: 403,
    cause,
  });
}

export function assertSameOrigin(
  request: Request,
  options: { allowMissingOrigin?: boolean } = {},
): void {
  const header = request.headers.get("origin");
  if (!header) {
    if (options.allowMissingOrigin) return;
    invalidOrigin();
  }

  try {
    const supplied = new URL(header);
    const expected = new URL(request.url);
    if (supplied.origin !== expected.origin) invalidOrigin();
  } catch (error) {
    if (error instanceof AppError) throw error;
    invalidOrigin(error);
  }
}
