import { z } from "zod";

export const socialHousingPlatformSchema = z.enum(["xiaohongshu", "douyin"]);

export const socialHousingLeadListItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(160),
    summary: z.string().min(1).max(500),
    community: z.string().nullable(),
    address: z.string().nullable(),
    district: z.string().nullable(),
    distanceM: z.number().finite().nonnegative(),
    monthlyRentMin: z.number().int().positive(),
    monthlyRentMax: z.number().int().positive().nullable(),
    rentType: z.string().nullable(),
    layout: z.string().nullable(),
    areaSqm: z.number().finite().positive().nullable(),
    location: z
      .object({
        longitude: z.number().finite().min(-180).max(180),
        latitude: z.number().finite().min(-90).max(90),
      })
      .strict(),
    coordinateSystem: z.literal("wgs84"),
    publishedAt: z.iso.datetime({ offset: true }),
    lastSeenAt: z.iso.datetime({ offset: true }),
    sourcePlatforms: z.array(socialHousingPlatformSchema).min(1).max(2),
    sourceCount: z.number().int().positive(),
    verificationLabel: z.literal("房态未经核验"),
  })
  .strict();

export const socialHousingListResponseSchema = z
  .object({
    items: z.array(socialHousingLeadListItemSchema).max(24),
    total: z.number().int().nonnegative(),
    nextCursor: z
      .string()
      .regex(/^offset:\d{1,6}$/u)
      .nullable(),
    source: z
      .object({
        source: z.literal("social_housing_leads"),
        label: z.string().min(1),
        isVerified: z.literal(false),
        mode: z.literal("supabase"),
        disclaimer: z.string().min(1),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();

export type SocialHousingListResponse = z.infer<
  typeof socialHousingListResponseSchema
>;
