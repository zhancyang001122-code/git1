import { AppError, toPublicError } from "@/lib/errors";

export function apiErrorResponse(error: unknown, requestId: string): Response {
  const status = error instanceof AppError ? error.status : 500;
  const normalized = toPublicError(error, requestId);
  return Response.json(
    { error: normalized },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-error-code": normalized.code,
        "x-request-id": requestId,
      },
    },
  );
}

export function noStoreHeaders(requestId: string): HeadersInit {
  return { "cache-control": "no-store", "x-request-id": requestId };
}
