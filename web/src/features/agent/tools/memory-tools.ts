import { z } from "zod";

import type { ToolInputs, ToolName } from "@/features/agent/tools/schemas";
import {
  toolContractDefinitions,
  toolInputSchemas,
} from "@/features/agent/tools/schemas";
import type {
  ErasedToolDefinition,
  ToolDefinition,
  ToolResult,
} from "@/features/agent/tools/types";
import type { UserPreferences } from "@/features/memory/repository";

function contract(name: ToolName) {
  return toolContractDefinitions.find(
    (definition) => definition.name === name,
  )!;
}

function authRequired(): ToolResult {
  return {
    ok: false,
    error: {
      code: "USER_AUTH_REQUIRED",
      message: "登录后才能读取或保存长期偏好",
      retryable: false,
    },
    source: "user_memory",
    resultCount: 0,
  };
}

function preferenceView(
  preferences: UserPreferences,
  scope: ToolInputs["get_user_preferences"]["scope"],
): Record<string, unknown> {
  const housing = {
    maxHousingBudget: preferences.maxHousingBudget,
    pets: preferences.pets,
    preferredAreas: preferences.preferredAreas,
    transportModes: preferences.transportModes,
    familyProfile: preferences.familyProfile,
  };
  const food = {
    dietaryRestrictions: preferences.dietaryRestrictions,
    familyProfile: preferences.familyProfile,
  };
  const shopping = {
    dietaryRestrictions: preferences.dietaryRestrictions,
    preferredAreas: preferences.preferredAreas,
    familyProfile: preferences.familyProfile,
  };
  if (scope === "housing") return housing;
  if (scope === "food") return food;
  if (scope === "shopping") return shopping;
  return {
    ...housing,
    dietaryRestrictions: preferences.dietaryRestrictions,
  };
}

const getUserPreferences: ToolDefinition<ToolInputs["get_user_preferences"]> = {
  ...contract("get_user_preferences"),
  publicLabel: "正在读取已授权偏好",
  source: () => "user_memory",
  inputSchema: toolInputSchemas.get_user_preferences,
  async execute(input, context) {
    if (!context.userId) return authRequired();
    const preferences = await context.memory.getPreferences(context.userId);
    if (!preferences?.allowLongTermMemory || preferences.consentedAt === null) {
      return {
        ok: true,
        data: { enabled: false, scope: input.scope },
        source: "user_memory",
        resultCount: 0,
      };
    }
    return {
      ok: true,
      data: {
        enabled: true,
        scope: input.scope,
        preferences: preferenceView(preferences, input.scope),
      },
      source: "user_memory",
      resultCount: 1,
    };
  },
};

const listValue = z.array(z.string().trim().min(1).max(80)).max(20);
const preferenceValueSchemas = {
  max_housing_budget: z.number().int().nonnegative().max(200_000),
  pets: listValue,
  preferred_areas: listValue,
  dietary_restrictions: listValue,
  transport_modes: listValue,
  family_profile: listValue,
} as const;

const inputKeys = {
  max_housing_budget: "maxHousingBudget",
  pets: "pets",
  preferred_areas: "preferredAreas",
  dietary_restrictions: "dietaryRestrictions",
  transport_modes: "transportModes",
  family_profile: "familyProfile",
} as const;

const saveUserPreference: ToolDefinition<ToolInputs["save_user_preference"]> = {
  ...contract("save_user_preference"),
  publicLabel: "正在保存已确认偏好",
  source: () => "user_memory",
  inputSchema: toolInputSchemas.save_user_preference,
  async execute(input, context) {
    if (!context.userId) return authRequired();
    const parsedValue = preferenceValueSchemas[input.key].safeParse(
      input.value,
    );
    if (!parsedValue.success) {
      return {
        ok: false,
        error: {
          code: "PREFERENCE_VALUE_INVALID",
          message: "该偏好值格式无效",
          retryable: false,
        },
        source: "user_memory",
        resultCount: 0,
      };
    }
    const consentedAt = new Date().toISOString();
    await context.memory.upsertPreferences(context.userId, {
      [inputKeys[input.key]]: parsedValue.data,
      allowLongTermMemory: true,
      consentedAt,
    });
    return {
      ok: true,
      data: {
        saved: true,
        key: input.key,
        value: parsedValue.data,
        consentedAt,
      },
      source: "user_memory",
      resultCount: 1,
    };
  },
};

export const memoryToolDefinitions: readonly ErasedToolDefinition[] = [
  getUserPreferences,
  saveUserPreference,
] as unknown as readonly ErasedToolDefinition[];
