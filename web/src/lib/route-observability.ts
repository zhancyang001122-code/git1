import { after } from "next/server";

import type { RouteLogInput } from "@/features/observability/route-log-repository";
import { parsePublicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { requestIdFor } from "@/lib/request-id";

type RouteHandler<Args extends unknown[]> = (
  request: Request,
  ...args: Args
) => Promise<Response> | Response;

interface ObserveRouteDependencies {
  now?: () => number;
  schedule?: (callback: () => Promise<void>) => void;
  record?: (input: RouteLogInput) => Promise<void>;
  warn?: (
    event: string,
    context: { requestId: string; errorCode: string; routeKey: string },
  ) => void;
}

let productionRecord: ((input: RouteLogInput) => Promise<void>) | undefined;

async function recordInConfiguredEnvironment(input: RouteLogInput) {
  if (parsePublicEnv(process.env).NEXT_PUBLIC_DEMO_MODE) return;
  if (!productionRecord) {
    const [
      { createAdminSupabaseClient },
      { createSupabaseRouteLogRepository },
    ] = await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/features/observability/route-log-repository"),
    ]);
    const repository = createSupabaseRouteLogRepository(
      createAdminSupabaseClient(),
    );
    productionRecord = (value) => repository.record(value);
  }
  await productionRecord(input);
}

function responseErrorCode(response: Response): string | null {
  const value = response.headers.get("x-error-code");
  return value && /^[A-Z][A-Z0-9_]{1,119}$/.test(value) ? value : null;
}

function responseRequestId(response: Response): string | null {
  const value = response.headers.get("x-request-id");
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

export function observeRoute<Args extends unknown[]>(
  routeKey: string,
  handler: RouteHandler<Args>,
  dependencies: ObserveRouteDependencies = {},
): RouteHandler<Args> {
  const now = dependencies.now ?? Date.now;
  const schedule = dependencies.schedule ?? after;
  const record = dependencies.record ?? recordInConfiguredEnvironment;
  const warn = dependencies.warn ?? logger.warn;

  return async (request, ...args) => {
    const startedAt = now();
    let requestId = requestIdFor(request);
    let statusCode = 500;
    let errorCode: string | null = null;
    try {
      const response = await handler(request, ...args);
      statusCode = response.status;
      errorCode = responseErrorCode(response);
      requestId = responseRequestId(response) ?? requestId;
      return response;
    } finally {
      const durationMs = Math.max(
        0,
        Math.min(300_000, Math.round(now() - startedAt)),
      );
      schedule(async () => {
        try {
          await record({
            routeKey,
            method: request.method as RouteLogInput["method"],
            statusCode,
            durationMs,
            requestId,
            errorCode,
          });
        } catch {
          warn("route_log.persist_failed", {
            requestId,
            errorCode: "ROUTE_LOG_PERSIST_FAILED",
            routeKey,
          });
        }
      });
    }
  };
}
