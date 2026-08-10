import { describe, expect, it, vi } from "vitest";

import geocodeSuccess from "../../../../tests/fixtures/amap/geocode-success.json";
import convertSuccess from "../../../../tests/fixtures/amap/convert-success.json";
import invalidKey from "../../../../tests/fixtures/amap/invalid-key.json";
import nearbySuccess from "../../../../tests/fixtures/amap/nearby-success.json";
import quota from "../../../../tests/fixtures/amap/quota.json";
import walkingSuccess from "../../../../tests/fixtures/amap/walking-success.json";
import { AmapAdapter } from "@/features/maps/amap-adapter";
import { AppError } from "@/lib/errors";

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("AmapAdapter", () => {
  it("converts browser GPS coordinates before AMap search", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(convertSuccess));
    const adapter = new AmapAdapter({ key: "server-key", fetcher });

    await expect(
      adapter.convertGps({ longitude: 120.163102, latitude: 30.274085 }),
    ).resolves.toEqual({ longitude: 120.167621, latitude: 30.271238 });
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v3/assistant/coordinate/convert");
    expect(url.searchParams.get("coordsys")).toBe("gps");
  });

  it("parses geocoding, nearby POIs and a walking route", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(geocodeSuccess))
      .mockResolvedValueOnce(response(nearbySuccess))
      .mockResolvedValueOnce(response(walkingSuccess));
    const adapter = new AmapAdapter({ key: "server-key", fetcher });

    await expect(
      adapter.geocode({ address: "武林广场", city: "杭州" }),
    ).resolves.toMatchObject({ longitude: 120.163102, latitude: 30.274085 });
    await expect(
      adapter.searchNearby({
        keyword: "商场",
        city: "杭州",
        center: { longitude: 120.163102, latitude: 30.274085 },
        radiusM: 1500,
        limit: 5,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "杭州大厦购物城",
          distanceM: 182,
          source: "amap",
        }),
      ]),
    );
    await expect(
      adapter.walkingRoute({
        origin: { longitude: 120.163102, latitude: 30.274085 },
        destination: { longitude: 120.16152, latitude: 30.274491 },
      }),
    ).resolves.toMatchObject({ distanceM: 418, durationSeconds: 360 });

    const nearbyUrl = new URL(String(fetcher.mock.calls[1]?.[0]));
    expect(nearbyUrl.pathname).toBe("/v3/place/around");
    expect(nearbyUrl.searchParams.get("location")).toBe("120.163102,30.274085");
    expect(nearbyUrl.searchParams.get("key")).toBe("server-key");
  });

  it.each([
    [invalidKey, "AMAP_UNAUTHORIZED"],
    [quota, "AMAP_QUOTA"],
  ])("normalizes AMap service errors", async (body, code) => {
    const adapter = new AmapAdapter({
      key: "server-key",
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(body)),
    });

    await expect(
      adapter.geocode({ address: "武林广场", city: "杭州" }),
    ).rejects.toMatchObject({ code } satisfies Partial<AppError>);
  });

  it("normalizes malformed payloads without leaking upstream details", async () => {
    const adapter = new AmapAdapter({
      key: "server-key",
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(response({ status: 1 })),
    });

    await expect(
      adapter.geocode({ address: "武林广场", city: "杭州" }),
    ).rejects.toMatchObject({
      code: "AMAP_INVALID_RESPONSE",
    } satisfies Partial<AppError>);
  });

  it("aborts slow requests with a stable timeout error", async () => {
    const adapter = new AmapAdapter({
      key: "server-key",
      timeoutMs: 5,
      fetcher: vi.fn(
        async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason),
            );
          });
        },
      ) as typeof fetch,
    });

    await expect(
      adapter.geocode({ address: "武林广场", city: "杭州" }),
    ).rejects.toMatchObject({
      code: "AMAP_TIMEOUT",
    } satisfies Partial<AppError>);
  });
});
