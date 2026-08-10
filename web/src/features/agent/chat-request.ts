import { z } from "zod";

const geoPointSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  })
  .strict();

export const chatRequestSchema = z
  .object({
    sessionId: z.uuid().optional(),
    message: z.string().trim().min(1).max(4_000),
    location: geoPointSchema.optional(),
    locationLabel: z.string().trim().max(120).optional(),
    context: z
      .object({
        sourceType: z
          .enum(["community_post", "house", "deal", "product"])
          .optional(),
        sourceId: z.uuid().optional(),
      })
      .strict()
      .optional(),
    debug: z.boolean().default(false),
  })
  .strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
