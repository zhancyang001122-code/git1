import { AppError, toPublicError } from "@/lib/errors";

export function apiErrorResponse(error: unknown, requestId: string): Response {
  const status = error instanceof AppError ? error.status : 500;
  return Response.json(
    { error: toPublicError(error, requestId) },
    {
      status,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}

export function noStoreHeaders(requestId: string): HeadersInit {
  return { "cache-control": "no-store", "x-request-id": requestId };
}
