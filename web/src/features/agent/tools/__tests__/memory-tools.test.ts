import { describe, expect, it, vi } from "vitest";

import { createTaskSixToolRegistry } from "@/features/agent/tools/registry";
import type {
  MemoryRepository,
  UserPreferences,
} from "@/features/memory/repository";

import { createToolTestContext } from "./helpers";

const userId = "70000000-0000-0000-0000-000000000001";

function preferences(
  overrides: Partial<UserPreferences> = {},
): UserPreferences {
  return {
    userId,
    maxHousingBudget: 3_500,
    pets: ["猫"],
    preferredAreas: ["拱墅区"],
    dietaryRestrictions: ["少辣"],
    transportModes: ["地铁"],
    familyProfile: [],
    allowLongTermMemory: true,
    consentedAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

function memoryRepository(
  value: UserPreferences | null = preferences(),
): MemoryRepository {
  return {
    getPreferences: vi.fn(async () => value),
    upsertPreferences: vi.fn(async (_userId, input) =>
      preferences({
        maxHousingBudget:
          input.maxHousingBudget === undefined
            ? (value?.maxHousingBudget ?? null)
            : input.maxHousingBudget,
        allowLongTermMemory: true,
      }),
    ),
    deletePreferences: vi.fn(async () => undefined),
  };
}

describe("memory tools", () => {
  it("returns only consented preferences in the requested scope", async () => {
    const enabled = await createTaskSixToolRegistry()
      .get("get_user_preferences")
      .execute(
        { scope: "housing" },
        createToolTestContext({ memory: memoryRepository(), userId }),
      );
    expect(enabled.data).toEqual({
      enabled: true,
      scope: "housing",
      preferences: {
        maxHousingBudget: 3_500,
        pets: ["猫"],
        preferredAreas: ["拱墅区"],
        transportModes: ["地铁"],
        familyProfile: [],
      },
    });

    const disabled = await createTaskSixToolRegistry()
      .get("get_user_preferences")
      .execute(
        { scope: "all" },
        createToolTestContext({
          memory: memoryRepository(
            preferences({ allowLongTermMemory: false, consentedAt: null }),
          ),
          userId,
        }),
      );
    expect(disabled.data).toEqual({ enabled: false, scope: "all" });
  });

  it("creates an anonymous-safe proposal without writing preferences", async () => {
    const repository = memoryRepository();
    const result = await createTaskSixToolRegistry()
      .get("propose_user_preference")
      .execute(
        {
          key: "max_housing_budget",
          value: 4_000,
        },
        createToolTestContext({ memory: repository, userId: null }),
      );

    expect(result).toMatchObject({
      ok: true,
      data: {
        proposed: true,
        key: "max_housing_budget",
        value: 4_000,
        requiresConfirmation: true,
      },
    });
    expect(repository.upsertPreferences).not.toHaveBeenCalled();
  });

  it("validates a key-specific value without claiming it was saved", async () => {
    const repository = memoryRepository();
    const tool = createTaskSixToolRegistry().get("propose_user_preference");
    const context = createToolTestContext({ memory: repository, userId });

    const invalid = await tool.execute(
      {
        key: "max_housing_budget",
        value: "3500",
      },
      context,
    );
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "PREFERENCE_VALUE_INVALID" },
    });

    const proposal = await tool.execute(
      {
        key: "max_housing_budget",
        value: 4_000,
      },
      context,
    );
    expect(proposal).toMatchObject({
      ok: true,
      data: {
        proposed: true,
        key: "max_housing_budget",
        value: 4_000,
        requiresConfirmation: true,
      },
    });
    expect(repository.upsertPreferences).not.toHaveBeenCalled();
  });
});
