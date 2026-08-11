import { z } from "zod";

const normalizedList = z
  .array(z.string().trim().min(1).max(80))
  .max(20)
  .transform((items) => [...new Set(items)]);

const preferenceValuesPatchSchema = z
  .object({
    maxHousingBudget: z
      .number()
      .int()
      .nonnegative()
      .max(200_000)
      .nullable()
      .optional(),
    preferredAreas: normalizedList.optional(),
    dietaryRestrictions: normalizedList.optional(),
    transportModes: normalizedList.optional(),
    familyProfile: normalizedList.optional(),
  })
  .strict();

const enabledPatchSchema = z
  .object({
    allowLongTermMemory: z.literal(true),
    preferences: preferenceValuesPatchSchema,
  })
  .strict();

const disabledPatchSchema = z
  .object({ allowLongTermMemory: z.literal(false) })
  .strict();

export const preferencePatchSchema = z
  .discriminatedUnion("allowLongTermMemory", [
    enabledPatchSchema,
    disabledPatchSchema,
  ])
  .superRefine((value, context) => {
    if (
      value.allowLongTermMemory &&
      Object.keys(value.preferences).length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["preferences"],
        message: "启用长期记忆时至少提交一个偏好字段",
      });
    }
  });

export type PreferencePatchInput = z.infer<typeof preferencePatchSchema>;
export type PreferenceValuesPatch = z.infer<typeof preferenceValuesPatchSchema>;

export interface PreferenceValues {
  maxHousingBudget: number | null;
  preferredAreas: readonly string[];
  dietaryRestrictions: readonly string[];
  transportModes: readonly string[];
  familyProfile: readonly string[];
}

export type PreferencesResponse =
  | {
      allowLongTermMemory: false;
      preferences: null;
      consentedAt: null;
      updatedAt: null;
    }
  | {
      allowLongTermMemory: true;
      preferences: PreferenceValues;
      consentedAt: string;
      updatedAt: string;
    };
