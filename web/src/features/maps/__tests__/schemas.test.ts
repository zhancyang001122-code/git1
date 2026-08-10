import { describe, expect, it } from "vitest";

import {
  nearbySearchInputSchema,
  parseCoordinate,
  serializeCoordinate,
} from "@/features/maps/schemas";

describe("map contracts", () => {
  it("serializes AMap coordinates in longitude,latitude order", () => {
    expect(
      serializeCoordinate({ longitude: 120.163102, latitude: 30.274085 }),
    ).toBe("120.163102,30.274085");
    expect(parseCoordinate("120.163102,30.274085")).toEqual({
      longitude: 120.163102,
      latitude: 30.274085,
    });
  });

  it("requires a named center or a complete coordinate pair", () => {
    const base = {
      keyword: "超市",
      city: "杭州",
      center_name: null,
      longitude: null,
      latitude: null,
      radius_m: 1500,
      limit: 5,
    };

    expect(nearbySearchInputSchema.safeParse(base).success).toBe(false);
    expect(
      nearbySearchInputSchema.safeParse({ ...base, center_name: "武林广场" })
        .success,
    ).toBe(true);
    expect(
      nearbySearchInputSchema.safeParse({
        ...base,
        longitude: 120.16,
        latitude: 30.27,
      }).success,
    ).toBe(true);
  });
});
