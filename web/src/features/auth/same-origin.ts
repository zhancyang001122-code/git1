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
    const requestUrl = new URL(request.url);
    const expectedOrigins = new Set([requestUrl.origin]);
    const host = request.headers.get("host");
    if (host) {
      const forwardedProtocol = request.headers
        .get("x-forwarded-proto")
        ?.split(",", 1)[0]
        ?.trim();
      const protocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
      expectedOrigins.add(new URL(`${protocol}://${host}`).origin);
    }
    if (!expectedOrigins.has(supplied.origin)) invalidOrigin();
  } catch (error) {
    if (error instanceof AppError) throw error;
    invalidOrigin(error);
  }
}
