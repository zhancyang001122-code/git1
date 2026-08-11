import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const stringList = z.array(z.string().trim().min(1).max(80)).max(20);
const preferencesPatchSchema = z
  .object({
    maxHousingBudget: z
      .number()
      .int()
      .nonnegative()
      .max(200_000)
      .nullable()
      .optional(),
    pets: stringList.optional(),
    preferredAreas: stringList.optional(),
    dietaryRestrictions: stringList.optional(),
    transportModes: stringList.optional(),
    familyProfile: stringList.optional(),
  })
  .strict();
const authorizationTimeSchema = z.string().datetime({ offset: true });

const preferencesRowSchema = z.object({
  user_id: uuid,
  max_housing_budget: z.coerce.number().int().nonnegative().nullable(),
  pets: z.array(z.string()),
  preferred_areas: z.array(z.string()),
  dietary_restrictions: z.array(z.string()),
  transport_modes: z.array(z.string()),
  family_profile: z.array(z.string()),
  allow_long_term_memory: z.boolean(),
  consented_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
});

const PREFERENCE_COLUMNS =
  "user_id,max_housing_budget,pets,preferred_areas,dietary_restrictions,transport_modes,family_profile,allow_long_term_memory,consented_at,updated_at";

export interface UserPreferences {
  userId: string;
  maxHousingBudget: number | null;
  pets: readonly string[];
  preferredAreas: readonly string[];
  dietaryRestrictions: readonly string[];
  transportModes: readonly string[];
  familyProfile: readonly string[];
  allowLongTermMemory: boolean;
  consentedAt: string | null;
  updatedAt: string;
}

export type PreferencesPatch = z.input<typeof preferencesPatchSchema>;

export interface MemoryRepository {
  getPreferences(userId: string): Promise<UserPreferences | null>;
  upsertPreferences(
    userId: string,
    input: PreferencesPatch,
    consentedAt: string,
  ): Promise<UserPreferences>;
  deletePreferences(userId: string): Promise<void>;
}

function invalidInput(cause: unknown): never {
  throw new AppError({
    code: "INVALID_PREFERENCES",
    message: "偏好参数无效",
    cause,
  });
}

function parseUserId(userId: string): string {
  const result = uuid.safeParse(userId);
  if (!result.success) invalidInput(result.error);
  return result.data;
}

function mapPreferences(row: unknown): UserPreferences {
  const result = preferencesRowSchema.safeParse(row);
  if (!result.success) {
    throw new AppError({
      code: "DATA_CONTRACT_INVALID",
      message: "偏好数据格式无效",
      cause: result.error,
    });
  }
  const value = result.data;
  return {
    userId: value.user_id,
    maxHousingBudget: value.max_housing_budget,
    pets: value.pets,
    preferredAreas: value.preferred_areas,
    dietaryRestrictions: value.dietary_restrictions,
    transportModes: value.transport_modes,
    familyProfile: value.family_profile,
    allowLongTermMemory: value.allow_long_term_memory,
    consentedAt: value.consented_at,
    updatedAt: value.updated_at,
  };
}

function queryFailed(cause: unknown): never {
  throw new AppError({
    code: "SUPABASE_QUERY_FAILED",
    message: "用户偏好暂时不可用",
    retryable: true,
    cause,
  });
}

export function createSupabaseMemoryRepository(
  client: SupabaseClient,
): MemoryRepository {
  return {
    async getPreferences(inputUserId) {
      const userId = parseUserId(inputUserId);
      const result = await client
        .from("user_preferences")
        .select(PREFERENCE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      if (result.error) queryFailed(result.error);
      return result.data ? mapPreferences(result.data) : null;
    },

    async upsertPreferences(inputUserId, input, inputConsentedAt) {
      const userId = parseUserId(inputUserId);
      const parsed = preferencesPatchSchema.safeParse(input);
      const parsedConsentedAt =
        authorizationTimeSchema.safeParse(inputConsentedAt);
      if (!parsed.success || !parsedConsentedAt.success) {
        invalidInput(parsed.success ? parsedConsentedAt.error : parsed.error);
      }
      const value = parsed.data;
      const payload = {
        user_id: userId,
        ...(value.maxHousingBudget !== undefined && {
          max_housing_budget: value.maxHousingBudget,
        }),
        ...(value.pets !== undefined && { pets: value.pets }),
        ...(value.preferredAreas !== undefined && {
          preferred_areas: value.preferredAreas,
        }),
        ...(value.dietaryRestrictions !== undefined && {
          dietary_restrictions: value.dietaryRestrictions,
        }),
        ...(value.transportModes !== undefined && {
          transport_modes: value.transportModes,
        }),
        ...(value.familyProfile !== undefined && {
          family_profile: value.familyProfile,
        }),
        allow_long_term_memory: true,
        consented_at: parsedConsentedAt.data,
      };
      const result = await client
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" })
        .select(PREFERENCE_COLUMNS)
        .single();
      if (result.error) queryFailed(result.error);
      return mapPreferences(result.data);
    },
    async deletePreferences(inputUserId) {
      const userId = parseUserId(inputUserId);
      const result = await client
        .from("user_preferences")
        .delete()
        .eq("user_id", userId);
      if (result.error) queryFailed(result.error);
    },
  };
}
