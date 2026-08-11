import { describe, expect, it, vi } from "vitest";

import type {
  MemoryRepository,
  UserPreferences,
} from "@/features/memory/repository";
import { createPreferencesService } from "@/features/preferences/service";

const userId = "70000000-0000-0000-0000-000000000001";
const consentedAt = "2026-08-11T00:00:00.000Z";
const now = new Date("2026-08-12T08:00:00.000Z");

function row(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    userId,
    maxHousingBudget: 3_500,
    preferredAreas: ["拱墅区"],
    dietaryRestrictions: [],
    transportModes: ["地铁"],
    familyProfile: [],
    allowLongTermMemory: true,
    consentedAt,
    updatedAt: "2026-08-11T01:00:00.000Z",
    ...overrides,
  };
}

function repository(existing: UserPreferences | null = null): MemoryRepository {
  return {
    getPreferences: vi.fn(async () => existing),
    upsertPreferences: vi.fn(async (_userId, patch, authorizationTime) =>
      row({
        ...patch,
        consentedAt: authorizationTime,
        updatedAt: now.toISOString(),
      }),
    ),
    deletePreferences: vi.fn(async () => undefined),
  };
}

describe("PreferencesService", () => {
  it("uses the server clock for first authorization", async () => {
    const memory = repository();
    const service = createPreferencesService(memory, () => now);
    const result = await service.patch(userId, {
      allowLongTermMemory: true,
      preferences: { dietaryRestrictions: ["不吃辣"] },
    });

    expect(memory.upsertPreferences).toHaveBeenCalledWith(
      userId,
      { dietaryRestrictions: ["不吃辣"] },
      now.toISOString(),
    );
    expect(result).toMatchObject({
      allowLongTermMemory: true,
      consentedAt: now.toISOString(),
    });
  });

  it("preserves the active authorization time on later edits", async () => {
    const memory = repository(row());
    const service = createPreferencesService(memory, () => now);
    await service.patch(userId, {
      allowLongTermMemory: true,
      preferences: { maxHousingBudget: 4_200 },
    });
    expect(memory.upsertPreferences).toHaveBeenCalledWith(
      userId,
      { maxHousingBudget: 4_200 },
      consentedAt,
    );
  });

  it("deletes the whole row when long-term memory is disabled", async () => {
    const memory = repository(row());
    const service = createPreferencesService(memory, () => now);
    const result = await service.patch(userId, {
      allowLongTermMemory: false,
    });

    expect(memory.deletePreferences).toHaveBeenCalledWith(userId);
    expect(memory.upsertPreferences).not.toHaveBeenCalled();
    expect(result).toEqual({
      allowLongTermMemory: false,
      preferences: null,
      consentedAt: null,
      updatedAt: null,
    });
  });

  it("does not expose a disabled or unconsented legacy row", async () => {
    const service = createPreferencesService(
      repository(row({ allowLongTermMemory: false, consentedAt: null })),
      () => now,
    );
    await expect(service.get(userId)).resolves.toEqual({
      allowLongTermMemory: false,
      preferences: null,
      consentedAt: null,
      updatedAt: null,
    });
  });
});
