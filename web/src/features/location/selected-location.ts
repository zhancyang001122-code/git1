import { z } from "zod";

export const SELECTED_LOCATION_STORAGE_KEY = "xiaozhi.selected-location.v1";

export const selectedLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(40),
    point: z
      .object({
        longitude: z.number().finite().min(-180).max(180),
        latitude: z.number().finite().min(-90).max(90),
      })
      .strict(),
    wgs84Point: z
      .object({
        longitude: z.number().finite().min(-180).max(180),
        latitude: z.number().finite().min(-90).max(90),
      })
      .strict(),
    source: z.enum(["default", "browser", "manual"]),
  })
  .strict();

export type SelectedLocation = z.infer<typeof selectedLocationSchema>;

export function selectedLocationLabel(location: SelectedLocation): string {
  return `${location.city} · ${location.name}`;
}

export function parseStoredLocation(
  value: string | null,
): SelectedLocation | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = selectedLocationSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
