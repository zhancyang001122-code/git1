import { z } from "zod";

import type { GeoPoint } from "@/features/maps/types";
import { AppError } from "@/lib/errors";

const longitudeSchema = z.number().finite().min(-180).max(180);
const latitudeSchema = z.number().finite().min(-90).max(90);

export const geoPointSchema = z
  .object({ longitude: longitudeSchema, latitude: latitudeSchema })
  .strict();

export const nearbySearchInputSchema = z
  .object({
    keyword: z.string().trim().min(1).max(80),
    city: z.string().trim().min(1).max(40),
    center_name: z.string().trim().min(1).max(120).nullable(),
    longitude: longitudeSchema.nullable(),
    latitude: latitudeSchema.nullable(),
    radius_m: z.number().int().min(100).max(5_000),
    limit: z.number().int().min(1).max(10),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.longitude === null) !== (value.latitude === null)) {
      context.addIssue({
        code: "custom",
        message: "经度和纬度必须成对提供",
        path: ["longitude"],
      });
    }
  });

export const walkingRouteInputSchema = z
  .object({
    origin_longitude: longitudeSchema,
    origin_latitude: latitudeSchema,
    destination_longitude: longitudeSchema,
    destination_latitude: latitudeSchema,
  })
  .strict();

export const nearbyApiRequestSchema = z.union([
  z
    .object({
      action: z.literal("resolve"),
      kind: z.literal("manual"),
      city: z.string().trim().min(1).max(40),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      action: z.literal("resolve"),
      kind: z.literal("browser"),
      point: geoPointSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("search"),
      keyword: z.string().trim().min(1).max(80),
      city: z.string().trim().min(1).max(40),
      center: geoPointSchema,
      coordinateSystem: z.enum(["gps", "amap"]),
      radiusM: z.number().int().min(100).max(5_000),
      limit: z.number().int().min(1).max(10),
    })
    .strict(),
  z
    .object({
      action: z.literal("route"),
      origin: geoPointSchema,
      destination: geoPointSchema,
    })
    .strict(),
]);

export function serializeCoordinate(point: GeoPoint): string {
  const parsed = geoPointSchema.parse(point);
  return `${parsed.longitude},${parsed.latitude}`;
}

export function parseCoordinate(value: string): GeoPoint {
  const [longitude, latitude, extra] = value.split(",");
  const parsed = geoPointSchema.safeParse({
    longitude: Number(longitude),
    latitude: Number(latitude),
  });
  if (!parsed.success || extra !== undefined) {
    throw new AppError({
      code: "AMAP_INVALID_RESPONSE",
      message: "高德地图返回了无法识别的坐标",
      retryable: true,
      cause: parsed.error,
    });
  }
  return parsed.data;
}
