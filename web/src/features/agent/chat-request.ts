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
    locationWgs84: geoPointSchema.optional(),
    locationLabel: z.string().trim().max(120).optional(),
    locationCity: z.string().trim().min(1).max(40).optional(),
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
  .strict()
  .superRefine((value, context) => {
    const fields = [
      value.location,
      value.locationWgs84,
      value.locationLabel,
      value.locationCity,
    ];
    const supplied = fields.filter((field) => field !== undefined).length;
    if (supplied !== 0 && supplied !== fields.length) {
      context.addIssue({
        code: "custom",
        message: "位置坐标、WGS84 坐标、城市和标签必须同时提供",
        path: ["location"],
      });
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
