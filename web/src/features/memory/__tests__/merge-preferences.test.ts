import { describe, expect, it } from "vitest";

import { mergePreferences } from "@/features/memory/merge-preferences";

describe("mergePreferences", () => {
  it("lets the current turn override long-term values without mutating them", () => {
    const longTerm = {
      maxHousingBudget: 3_500,
      preferredAreas: ["拱墅区"],
      transportModes: ["地铁"],
    };

    const merged = mergePreferences(longTerm, { maxHousingBudget: 4_000 });

    expect(merged).toEqual({
      maxHousingBudget: 4_000,
      preferredAreas: ["拱墅区"],
      transportModes: ["地铁"],
    });
    expect(longTerm.maxHousingBudget).toBe(3_500);
  });

  it("ignores undefined current-turn fields", () => {
    expect(
      mergePreferences(
        { maxHousingBudget: 3_500, dietary: "清淡" },
        { maxHousingBudget: undefined },
      ),
    ).toEqual({ maxHousingBudget: 3_500, dietary: "清淡" });
  });
});
