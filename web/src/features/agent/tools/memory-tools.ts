import { preferenceProposalDataSchema } from "@/features/agent/chat-events";
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

const proposeUserPreference: ToolDefinition<
  ToolInputs["propose_user_preference"]
> = {
  ...contract("propose_user_preference"),
  publicLabel: "正在准备偏好确认",
  source: () => "user_memory",
  inputSchema: toolInputSchemas.propose_user_preference,
  async execute(input) {
    const proposal = preferenceProposalDataSchema.safeParse({
      id: `preference-proposal:${input.key}`,
      proposed: true,
      key: input.key,
      value: input.value,
      requiresConfirmation: true,
    });
    if (!proposal.success) {
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
    return {
      ok: true,
      data: proposal.data,
      cards: [{ kind: "preference_proposal", data: proposal.data }],
      source: "user_memory",
      resultCount: 1,
    };
  },
};

export const memoryToolDefinitions: readonly ErasedToolDefinition[] = [
  getUserPreferences,
  proposeUserPreference,
] as unknown as readonly ErasedToolDefinition[];
