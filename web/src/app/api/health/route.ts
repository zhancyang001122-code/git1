import { getServiceConfiguration } from "@/lib/env";
import { requestIdFor } from "@/lib/request-id";
import { observeRoute } from "@/lib/route-observability";

export function createHealthHandler() {
  return function GET(request: Request): Response {
    const configuration = getServiceConfiguration();
    const requestId = requestIdFor(request);
    const commit =
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.APP_COMMIT_SHA?.trim() ||
      null;

    return Response.json(
      {
        app: "xiaozhi",
        mode: configuration.mode,
        services: configuration.services,
        deployment: { commit },
      },
      {
        headers: { "cache-control": "no-store", "x-request-id": requestId },
      },
    );
  };
}

export const GET = observeRoute("/api/health", createHealthHandler());
