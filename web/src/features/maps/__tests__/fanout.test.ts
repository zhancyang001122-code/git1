import { describe, expect, it } from "vitest";

import { evaluateNearbyForCandidates } from "@/features/maps/service";
import type { MapsService } from "@/features/maps/types";

describe("bounded nearby fan-out", () => {
  it("checks at most five candidates with at most three concurrent requests", async () => {
    let active = 0;
    let peak = 0;
    let calls = 0;
    let routeCalls = 0;
    const service: MapsService = {
      convertGps: async (point) => point,
      geocode: async () => null,
      reverseGeocode: async () => null,
      walkingRoute: async (input) => {
        routeCalls += 1;
        return {
          distanceM: 200,
          durationSeconds: 180,
          origin: input.origin,
          destination: input.destination,
          steps: [],
          source: "amap",
          isDemo: true,
        };
      },
      async searchNearby(input) {
        calls += 1;
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return [
          {
            id: String(calls),
            name: "便利店",
            address: "测试地址",
            category: "购物服务",
            distanceM: 100,
            location: input.center,
            source: "amap",
            isDemo: true,
          },
        ];
      },
    };
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      location: { longitude: 120 + index / 100, latitude: 30 },
    }));

    const result = await evaluateNearbyForCandidates(service, candidates, {
      keyword: "便利店",
      city: "杭州",
      radiusM: 1000,
      limit: 3,
    });

    expect(result).toHaveLength(5);
    expect(calls).toBe(5);
    expect(peak).toBeLessThanOrEqual(3);
    expect(routeCalls).toBe(3);
    expect(result.filter((item) => item.walkingRoute !== null)).toHaveLength(3);
  });
});
