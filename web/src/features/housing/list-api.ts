import "server-only";

import { z } from "zod";

import { createHousingRuntime } from "@/features/housing/runtime";
import type { HousingRuntime } from "@/features/housing/types";
import { apiErrorResponse, noStoreHeaders } from "@/lib/api-error-response";
import { AppError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(max).optional());

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (typeof normalized !== "string") return normalized;
    return /^-?\d+(?:\.\d+)?$/u.test(normalized)
      ? Number(normalized)
      : normalized;
  }, schema.optional());

const optionalInteger = (max: number) =>
  optionalNumber(z.number().int().nonnegative().max(max));

const querySchema = z
  .object({
    city: optionalText(40),
    longitude: optionalNumber(z.number().finite().min(-180).max(180)),
    latitude: optionalNumber(z.number().finite().min(-90).max(90)),
    locationLabel: optionalText(120),
    minPrice: optionalInteger(1_000_000),
    maxPrice: optionalInteger(1_000_000),
    roomType: z.preprocess(
      emptyToUndefined,
      z.enum(["一居室", "两居室", "开间", "整租", "合租"]).optional(),
    ),
    sort: z.preprocess(
      emptyToUndefined,
      z
        .enum(["distance_asc", "price_asc", "price_desc", "area_desc"])
        .default("distance_asc"),
    ),
    cursor: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^offset:\d{1,6}$/u)
        .optional(),
    ),
    limit: z.preprocess((value) => {
      const normalized = emptyToUndefined(value);
      if (typeof normalized !== "string") return normalized;
      return /^\d+$/u.test(normalized) ? Number(normalized) : normalized;
    }, z.number().int().min(1).max(24).default(24)),
  })
  .strict()
  .superRefine((value, context) => {
    const suppliedLocation = [
      value.longitude,
      value.latitude,
      value.locationLabel,
    ].filter((item) => item !== undefined).length;
    if (suppliedLocation !== 0 && suppliedLocation !== 3) {
      context.addIssue({
        code: "custom",
        path: ["locationLabel"],
        message: "位置名称和经纬度必须同时提供",
      });
    }
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxPrice"],
        message: "最高租金不能低于最低租金",
      });
    }
  });

type HousingRuntimeFactory = () => HousingRuntime;

function queryRecord(searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of searchParams) {
    const existing = result[key];
    result[key] = existing === undefined ? value : [existing, value];
  }
  return result;
}

function roomFilters(roomType: z.infer<typeof querySchema>["roomType"]): {
  rentType: "整租" | "合租" | null;
  layout: string | null;
} {
  if (roomType === "整租" || roomType === "合租") {
    return { rentType: roomType, layout: null };
  }
  if (roomType === "一居室") return { rentType: null, layout: "1室" };
  if (roomType === "两居室") return { rentType: null, layout: "2室" };
  if (roomType === "开间") return { rentType: null, layout: "0室" };
  return { rentType: null, layout: null };
}

function invalidQuery(cause: unknown): never {
  throw new AppError({
    code: "BUSINESS_QUERY_INVALID",
    message: "房源查询参数格式无效",
    status: 400,
    retryable: false,
    cause,
  });
}

export function createHistoricalHousesHandler(
  runtimeFactory: HousingRuntimeFactory = createHousingRuntime,
) {
  return async function GET(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const parsed = querySchema.safeParse(
        queryRecord(new URL(request.url).searchParams),
      );
      if (!parsed.success) invalidQuery(parsed.error);
      const value = parsed.data;
      const city = value.city ?? "杭州";
      if (city !== "杭州") {
        throw new AppError({
          code: "HOUSING_UNSUPPORTED_CITY",
          message: "2024-11 历史房源目前只覆盖杭州，请切换到杭州位置",
          status: 400,
          retryable: false,
        });
      }

      const runtime = runtimeFactory();
      if (runtime.mode !== "supabase" || !runtime.service) {
        throw new AppError({
          code: "HOUSING_NOT_CONFIGURED",
          message: "历史房源服务尚未配置",
          status: 503,
          retryable: true,
        });
      }
      const room = roomFilters(value.roomType);
      const center =
        value.longitude !== undefined &&
        value.latitude !== undefined &&
        value.locationLabel
          ? {
              label: value.locationLabel,
              longitude: value.longitude,
              latitude: value.latitude,
            }
          : runtime.defaultCenter;
      const offset = value.cursor
        ? Number.parseInt(value.cursor.slice("offset:".length), 10)
        : 0;
      const result = await runtime.service.search(
        {
          city,
          center,
          radiusM: null,
          filters: {
            minPrice: value.minPrice ?? null,
            maxPrice: value.maxPrice ?? null,
            rentType: room.rentType,
            layout: room.layout,
            minArea: null,
            maxArea: null,
            district: null,
          },
          sort: value.sort === "distance_asc" ? "distance" : value.sort,
          offset,
          limit: value.limit,
        },
        request.signal,
      );

      return Response.json(
        {
          items: result.items,
          total: result.total,
          nextCursor: result.nextCursor,
          source: {
            source: "housing_history_2024",
            label: result.sourceLabel,
            isDemo: false,
            mode: "supabase",
            datasetPeriod: result.datasetPeriod,
            disclaimer: result.disclaimer,
          },
          warnings: result.warnings,
        },
        { headers: noStoreHeaders(requestId) },
      );
    } catch (error) {
      return apiErrorResponse(error, requestId);
    }
  };
}
