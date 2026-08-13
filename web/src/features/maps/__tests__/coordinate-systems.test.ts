import { describe, expect, it } from "vitest";

import { gcj02ToWgs84, wgs84ToGcj02 } from "@/features/maps/coordinate-systems";

describe("coordinate systems", () => {
  it("round-trips a Hangzhou coordinate without mixing GCJ-02 and WGS84", () => {
    const wgs84 = { longitude: 120.1585, latitude: 30.2741 };
    const gcj02 = wgs84ToGcj02(wgs84);
    const restored = gcj02ToWgs84(gcj02);

    expect(gcj02.longitude).not.toBeCloseTo(wgs84.longitude, 5);
    expect(restored.longitude).toBeCloseTo(wgs84.longitude, 6);
    expect(restored.latitude).toBeCloseTo(wgs84.latitude, 6);
  });

  it("does not transform coordinates outside China", () => {
    const paris = { longitude: 2.3522, latitude: 48.8566 };
    expect(wgs84ToGcj02(paris)).toEqual(paris);
    expect(gcj02ToWgs84(paris)).toEqual(paris);
  });
});
