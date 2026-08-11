import { describe, expect, it } from "vitest";

import { preferencePatchSchema } from "@/features/preferences/schemas";

describe("preferencePatchSchema", () => {
  it("normalizes a partial enabled preference update", () => {
    expect(
      preferencePatchSchema.parse({
        allowLongTermMemory: true,
        preferences: {
          maxHousingBudget: null,
          preferredAreas: [" 西湖区 ", "西湖区", "拱墅区"],
          dietaryRestrictions: [],
        },
      }),
    ).toEqual({
      allowLongTermMemory: true,
      preferences: {
        maxHousingBudget: null,
        preferredAreas: ["西湖区", "拱墅区"],
        dietaryRestrictions: [],
      },
    });
  });

  it("rejects identity, client consent time and an empty enabled update", () => {
    for (const value of [
      {
        allowLongTermMemory: true,
        preferences: { preferredAreas: ["西湖区"] },
        userId: "70000000-0000-0000-0000-000000000001",
      },
      {
        allowLongTermMemory: true,
        preferences: { preferredAreas: ["西湖区"] },
        consentedAt: "2026-08-12T00:00:00.000Z",
      },
      { allowLongTermMemory: true, preferences: {} },
    ]) {
      expect(preferencePatchSchema.safeParse(value).success).toBe(false);
    }
  });

  it("accepts a clean disable command but rejects hidden retained values", () => {
    expect(
      preferencePatchSchema.safeParse({ allowLongTermMemory: false }).success,
    ).toBe(true);
    expect(
      preferencePatchSchema.safeParse({
        allowLongTermMemory: false,
        preferences: { preferredAreas: ["西湖区"] },
      }).success,
    ).toBe(false);
  });

  it("bounds numeric and list values", () => {
    expect(
      preferencePatchSchema.safeParse({
        allowLongTermMemory: true,
        preferences: { maxHousingBudget: 200_001 },
      }).success,
    ).toBe(false);
    expect(
      preferencePatchSchema.safeParse({
        allowLongTermMemory: true,
        preferences: {
          preferredAreas: Array.from(
            { length: 21 },
            (_, index) => `区域${index}`,
          ),
        },
      }).success,
    ).toBe(false);
  });
});
