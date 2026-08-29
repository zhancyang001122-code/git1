import { describe, expect, it } from "vitest";

import {
  formatStraightLineDistance,
  straightLineDistanceM,
} from "@/features/maps/straight-line-distance";

describe("straight-line distance", () => {
  it("calculates a stable great-circle distance in metres", () => {
    expect(
      straightLineDistanceM(
        { longitude: 120.163102, latitude: 30.274085 },
        { longitude: 120.1626, latitude: 30.2762 },
      ),
    ).toBe(240);
  });

  it("formats short, kilometre and capped distances", () => {
    expect(formatStraightLineDistance(318)).toBe("318m");
    expect(formatStraightLineDistance(1_250)).toBe("1.3km");
    expect(formatStraightLineDistance(10_000)).toBe("10km");
    expect(formatStraightLineDistance(10_001)).toBe(">10km");
  });
});
