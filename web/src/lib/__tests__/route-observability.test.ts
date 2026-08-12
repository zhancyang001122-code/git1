import { describe, expect, it, vi } from "vitest";

import { observeRoute } from "@/lib/route-observability";

describe("observeRoute", () => {
  it("schedules a safe metadata record after preserving the response", async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const record = vi.fn(async () => undefined);
    const requestId = "81000000-0000-4000-8000-000000000001";
    const post = observeRoute(
      "/api/example",
      async () =>
        Response.json(
          { secretPayload: "must-not-be-logged" },
          { status: 202, headers: { "x-request-id": requestId } },
        ),
      {
        now: () => 1_250,
        schedule: (callback) => callbacks.push(callback),
        record,
      },
    );

    const response = await post(
      new Request("https://example.test/api/example?private=query", {
        method: "POST",
        headers: {
          cookie: "session=private",
          authorization: "Bearer private",
        },
        body: JSON.stringify({ private: true }),
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      secretPayload: "must-not-be-logged",
    });
    expect(record).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);
    await callbacks[0]?.();
    expect(record).toHaveBeenCalledWith({
      routeKey: "/api/example",
      method: "POST",
      statusCode: 202,
      durationMs: 0,
      requestId,
      errorCode: null,
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain("private");
  });

  it("records thrown handlers as 500 and rethrows the original error", async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const record = vi.fn(async () => undefined);
    const failure = new Error("sensitive failure detail");
    const get = observeRoute(
      "/api/failure",
      async () => {
        throw failure;
      },
      {
        now: () => 9_000,
        schedule: (callback) => callbacks.push(callback),
        record,
      },
    );

    await expect(
      get(
        new Request("https://example.test/api/failure", {
          headers: {
            "x-request-id": "81000000-0000-4000-8000-000000000002",
          },
        }),
      ),
    ).rejects.toBe(failure);
    await callbacks[0]?.();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, errorCode: null }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain(
      "sensitive failure detail",
    );
  });

  it("passes through the exact framework request object", async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const request = new Request("https://example.test/api/passthrough");
    const handler = vi.fn(async (received: Request) =>
      Response.json({ same: received === request }),
    );
    const get = observeRoute("/api/passthrough", handler, {
      schedule: (callback) => callbacks.push(callback),
      record: async () => undefined,
    });

    const response = await get(request);

    await expect(response.json()).resolves.toEqual({ same: true });
    expect(handler).toHaveBeenCalledWith(request);
    await callbacks[0]?.();
  });

  it("swallows persistence failure after emitting only a stable warning", async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const warn = vi.fn();
    const get = observeRoute(
      "/api/health",
      async () => Response.json({ ok: true }),
      {
        schedule: (callback) => callbacks.push(callback),
        record: async () => {
          throw new Error("database credentials and private details");
        },
        warn,
      },
    );

    expect(
      (await get(new Request("https://example.test/api/health"))).status,
    ).toBe(200);
    await expect(callbacks[0]?.()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "route_log.persist_failed",
      expect.objectContaining({ errorCode: "ROUTE_LOG_PERSIST_FAILED" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("credentials");
  });
});
