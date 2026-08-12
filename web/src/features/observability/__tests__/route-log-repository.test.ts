import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabaseRouteLogRepository } from "@/features/observability/route-log-repository";

interface Call {
  method: string;
  args: unknown[];
}

function fakeClient(response: { error?: unknown }) {
  const calls: Call[] = [];
  const builder = new Proxy(
    {
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ error: response.error ?? null }).then(resolve);
      },
    },
    {
      get(target, property) {
        if (property === "then") return target.then.bind(target);
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

describe("SupabaseRouteLogRepository", () => {
  it("persists only bounded route metadata", async () => {
    const fake = fakeClient({});
    await createSupabaseRouteLogRepository(fake.client).record({
      routeKey: "/api/maps/nearby",
      method: "POST",
      statusCode: 200,
      durationMs: 42,
      requestId: "81000000-0000-4000-8000-000000000001",
      errorCode: null,
    });

    expect(fake.calls).toContainEqual({
      method: "from",
      args: ["api_route_logs"],
    });
    expect(
      fake.calls.find((call) => call.method === "insert")?.args[0],
    ).toEqual({
      route_key: "/api/maps/nearby",
      method: "POST",
      status_code: 200,
      duration_ms: 42,
      request_id: "81000000-0000-4000-8000-000000000001",
      error_code: null,
    });
  });

  it("rejects unbounded metadata before touching Supabase", async () => {
    const fake = fakeClient({});
    await expect(
      createSupabaseRouteLogRepository(fake.client).record({
        routeKey: `/api/${"x".repeat(200)}`,
        method: "POST",
        statusCode: 200,
        durationMs: 42,
        requestId: "81000000-0000-4000-8000-000000000001",
        errorCode: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ROUTE_LOG_INPUT" });
    expect(fake.calls).toHaveLength(0);
  });
});
