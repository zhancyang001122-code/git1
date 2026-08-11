import type {
  MemoryRepository,
  UserPreferences,
} from "@/features/memory/repository";
import type {
  PreferencePatchInput,
  PreferencesResponse,
} from "@/features/preferences/schemas";
import { AppError } from "@/lib/errors";

const disabledResponse: PreferencesResponse = {
  allowLongTermMemory: false,
  preferences: null,
  consentedAt: null,
  updatedAt: null,
};

function toResponse(value: UserPreferences | null): PreferencesResponse {
  if (!value || !value.allowLongTermMemory || value.consentedAt === null) {
    return disabledResponse;
  }
  return {
    allowLongTermMemory: true,
    preferences: {
      maxHousingBudget: value.maxHousingBudget,
      pets: value.pets,
      preferredAreas: value.preferredAreas,
      dietaryRestrictions: value.dietaryRestrictions,
      transportModes: value.transportModes,
      familyProfile: value.familyProfile,
    },
    consentedAt: value.consentedAt,
    updatedAt: value.updatedAt,
  };
}

function unavailable(error: unknown): never {
  throw new AppError({
    code: "PREFERENCES_UNAVAILABLE",
    message: "偏好服务暂时不可用，请稍后重试",
    status: 503,
    retryable: true,
    cause: error,
  });
}

export interface PreferencesService {
  get(userId: string): Promise<PreferencesResponse>;
  patch(
    userId: string,
    input: PreferencePatchInput,
  ): Promise<PreferencesResponse>;
}

export function createPreferencesService(
  memory: MemoryRepository,
  now: () => Date = () => new Date(),
): PreferencesService {
  return {
    async get(userId) {
      try {
        return toResponse(await memory.getPreferences(userId));
      } catch (error) {
        return unavailable(error);
      }
    },
    async patch(userId, input) {
      try {
        if (!input.allowLongTermMemory) {
          await memory.deletePreferences(userId);
          return disabledResponse;
        }
        const existing = await memory.getPreferences(userId);
        const authorizationTime =
          existing?.allowLongTermMemory && existing.consentedAt
            ? existing.consentedAt
            : now().toISOString();
        const saved = await memory.upsertPreferences(
          userId,
          input.preferences,
          authorizationTime,
        );
        return toResponse(saved);
      } catch (error) {
        return unavailable(error);
      }
    },
  };
}
