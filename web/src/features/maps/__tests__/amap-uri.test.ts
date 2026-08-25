import { describe, expect, it } from "vitest";

import { buildAmapWalkingNavigationUrl } from "@/features/maps/amap-uri";

describe("AMap URI navigation", () => {
  it("builds a walking route link for a GCJ-02 place", () => {
    const url = new URL(
      buildAmapWalkingNavigationUrl({
        destination: { longitude: 120.16328, latitude: 30.27415 },
        destinationName: "武林生活超市",
      }),
    );

    expect(url.origin).toBe("https://uri.amap.com");
    expect(url.pathname).toBe("/navigation");
    expect(url.searchParams.get("mode")).toBe("walk");
    expect(url.searchParams.get("to")).toBe(
      "120.163280,30.274150,武林生活超市",
    );
  });

  it("converts historical WGS84 coordinates before opening AMap", () => {
    const original = { longitude: 120.1585, latitude: 30.2764 };
    const url = new URL(
      buildAmapWalkingNavigationUrl({
        destination: original,
        destinationName: "历史房源",
        coordinateSystem: "wgs84",
      }),
    );
    const [longitude, latitude] = url.searchParams
      .get("to")!
      .split(",")
      .map(Number);

    expect(longitude).not.toBeCloseTo(original.longitude, 5);
    expect(latitude).not.toBeCloseTo(original.latitude, 5);
  });
});
