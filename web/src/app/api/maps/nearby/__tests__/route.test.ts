import { describe, expect, it, vi } from "vitest";

import { createNearbyMapsHandler } from "@/app/api/maps/nearby/route";
import { FakeMapsService } from "@/features/maps/fake-adapter";

function request(body: unknown) {
  return new Request("http://localhost/api/maps/nearby", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("nearby maps route", () => {
  it("rejects a shared rate-limit overflow before creating the runtime", async () => {
    const runtimeFactory = vi.fn(async () => ({
      service: new FakeMapsService(),
      mode: "demo" as const,
    }));
    const response = await createNearbyMapsHandler(runtimeFactory, {
      check: () => ({ allowed: false, remaining: 0, retryAfterSeconds: 23 }),
    })(
      request({
        action: "search",
        keyword: "超市",
        city: "杭州",
        center: { longitude: 120.163102, latitude: 30.274085 },
        coordinateSystem: "amap",
        radiusM: 1500,
        limit: 5,
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("23");
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before creating the runtime", async () => {
    const runtimeFactory = vi.fn(async () => ({
      service: new FakeMapsService(),
      mode: "demo" as const,
    }));
    const response = await createNearbyMapsHandler(runtimeFactory)(
      request({ padding: "测".repeat(3_000) }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_BODY_TOO_LARGE" },
    });
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it("rejects malformed coordinates before calling a service", async () => {
    const response = await createNearbyMapsHandler(async () => ({
      service: new FakeMapsService(),
      mode: "demo",
    }))(
      request({
        action: "search",
        keyword: "超市",
        city: "杭州",
        center: { longitude: 999, latitude: 30 },
        coordinateSystem: "amap",
        radiusM: 1500,
        limit: 5,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_MAP_REQUEST" },
    });
  });

  it("labels fixture search results instead of presenting them as live AMap", async () => {
    const response = await createNearbyMapsHandler(async () => ({
      service: new FakeMapsService(),
      mode: "demo",
    }))(
      request({
        action: "search",
        keyword: "超市",
        city: "杭州",
        center: { longitude: 120.163102, latitude: 30.274085 },
        coordinateSystem: "amap",
        radiusM: 1500,
        limit: 5,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: "demo",
      warning: "当前为高德接口演示数据，未发起实时调用",
      center: { longitude: 120.163102, latitude: 30.274085 },
      data: [{ source: "amap", isDemo: true }],
    });
  });
});
