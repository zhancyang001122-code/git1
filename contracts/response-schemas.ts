import { z } from "zod";

export const geoPointSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4000),
  location: geoPointSchema.optional(),
  locationLabel: z.string().trim().max(120).optional(),
  context: z
    .object({
      sourceType: z
        .enum(["community_post", "house", "deal", "product"])
        .optional(),
      sourceId: z.string().uuid().optional(),
    })
    .optional(),
  debug: z.boolean().default(false),
});

export const feedbackRequestSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  rating: z.enum(["up", "down"]),
  reason: z
    .enum([
      "incorrect",
      "not_relevant",
      "missing_source",
      "unsafe",
      "outdated",
      "other",
    ])
    .optional(),
  comment: z.string().trim().max(1000).optional(),
});

export const preferencePatchSchema = z
  .object({
    maxHousingBudget: z.number().int().min(0).max(200000).nullable().optional(),
    preferredAreas: z
      .array(z.string().trim().min(1).max(80))
      .max(10)
      .optional(),
    dietaryRestrictions: z
      .array(z.string().trim().min(1).max(80))
      .max(10)
      .optional(),
    transportModes: z
      .array(z.string().trim().min(1).max(40))
      .max(10)
      .optional(),
    familyProfile: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    allowLongTermMemory: z.boolean().optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
export type PreferencePatch = z.infer<typeof preferencePatchSchema>;
