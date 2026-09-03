import { z } from "zod";

export const historicalHousingListItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().nullable(),
    community: z.string().nullable(),
    address: z.string().nullable(),
    district: z.string().nullable(),
    distanceM: z.number().finite().nonnegative(),
    monthlyRent: z.number().int().positive(),
    rentType: z.string().nullable(),
    layout: z.string().nullable(),
    areaSqm: z.number().finite().positive().nullable(),
    orientation: z.string().nullable(),
    floor: z.string().nullable(),
    sourceUrl: z.string().url().nullable(),
    location: z
      .object({
        longitude: z.number().finite().min(-180).max(180),
        latitude: z.number().finite().min(-90).max(90),
      })
      .strict(),
    datasetPeriod: z.literal("2024-11"),
  })
  .strict();

export const historicalHousingListResponseSchema = z
  .object({
    items: z.array(historicalHousingListItemSchema).max(24),
    total: z.number().int().nonnegative(),
    nextCursor: z
      .string()
      .regex(/^offset:\d{1,6}$/u)
      .nullable(),
    source: z
      .object({
        source: z.literal("housing_history_2024"),
        label: z.string().min(1),
        isDemo: z.literal(false),
        mode: z.literal("supabase"),
        datasetPeriod: z.literal("2024-11"),
        disclaimer: z.string().min(1),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();

export type HistoricalHousingListResponse = z.infer<
  typeof historicalHousingListResponseSchema
>;
