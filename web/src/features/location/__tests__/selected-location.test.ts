import { describe, expect, it } from "vitest";

import {
  parseStoredLocation,
  selectedLocationSchema,
} from "@/features/location/selected-location";

describe("selected location", () => {
  it("accepts a complete manually selected AMap location", () => {
    expect(
      selectedLocationSchema.parse({
        name: "鲁迅故里",
        city: "绍兴",
        point: { longitude: 120.586109, latitude: 29.995762 },
        wgs84Point: { longitude: 120.5815, latitude: 29.9982 },
        source: "manual",
      }),
    ).toEqual({
      name: "鲁迅故里",
      city: "绍兴",
      point: { longitude: 120.586109, latitude: 29.995762 },
      wgs84Point: { longitude: 120.5815, latitude: 29.9982 },
      source: "manual",
    });
  });

  it("rejects corrupt or incomplete browser storage instead of trusting it", () => {
    expect(parseStoredLocation("not-json")).toBeNull();
    expect(
      parseStoredLocation(
        JSON.stringify({
          name: "错误坐标",
          city: "杭州",
          point: { longitude: 999, latitude: 30 },
          source: "manual",
        }),
      ),
    ).toBeNull();
  });
});
