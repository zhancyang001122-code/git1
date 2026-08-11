import type { RateLimitResult } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

export async function readJsonWithLimit(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AppError({
      code: "REQUEST_BODY_TOO_LARGE",
      message: "请求内容过大",
      status: 413,
    });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new AppError({
      code: "REQUEST_BODY_TOO_LARGE",
      message: "请求内容过大",
      status: 413,
    });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AppError({
      code: "INVALID_JSON",
      message: "请求不是有效 JSON",
      status: 400,
      cause: error,
    });
  }
}

export function rateLimitResponse(
  result: RateLimitResult,
  requestId: string,
  error: { code: string; message: string } = {
    code: "RATE_LIMITED",
    message: "请求过于频繁，请稍后重试",
  },
): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        retryable: true,
        requestId,
      },
    },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(result.retryAfterSeconds),
        "x-request-id": requestId,
      },
    },
  );
}
