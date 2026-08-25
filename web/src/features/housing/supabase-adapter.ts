import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  HistoricalHousingDetail,
  HistoricalHousingItem,
  HistoricalHousingSearchResult,
  HousingSearchInput,
  HousingSearchService,
} from "@/features/housing/types";
import { AppError } from "@/lib/errors";

const SOURCE_LABEL = "2024年11月杭州租房历史快照";
const DATASET_PERIOD = "2024-11" as const;
const DISCLAIMER = "仅供历史房源参考，不代表当前仍可出租或当前价格";

const finiteNumber = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^-?\d+(?:\.\d+)?$/),
  ])
  .transform(Number)
  .pipe(z.number().finite());

const inputSchema = z
  .object({
    city: z.string().trim().min(1).max(40),
    center: z
      .object({
        label: z.string().trim().min(1).max(120),
        longitude: z.number().finite().min(-180).max(180),
        latitude: z.number().finite().min(-90).max(90),
      })
      .strict(),
    radiusM: z.number().int().min(100).max(5_000),
    filters: z
      .object({
        minPrice: z.number().int().min(0).max(1_000_000).nullable(),
        maxPrice: z.number().int().min(0).max(1_000_000).nullable(),
        rentType: z.enum(["整租", "合租"]).nullable(),
        layout: z
          .string()
          .trim()
          .regex(/^\d{1,2}室(?:.*)?$/u)
          .nullable(),
        minArea: z.number().finite().positive().max(100_000).nullable(),
        maxArea: z.number().finite().positive().max(100_000).nullable(),
        district: z.string().trim().min(1).max(80).nullable(),
      })
      .strict(),
    sort: z.enum(["distance", "price_asc", "price_desc", "area_desc"]),
    limit: z.number().int().min(1).max(10),
  })
  .strict()
  .superRefine((value, context) => {
    const { filters } = value;
    if (
      filters.minPrice !== null &&
      filters.maxPrice !== null &&
      filters.minPrice > filters.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["filters", "minPrice"],
        message: "最低租金不能高于最高租金",
      });
    }
    if (
      filters.minArea !== null &&
      filters.maxArea !== null &&
      filters.minArea > filters.maxArea
    ) {
      context.addIssue({
        code: "custom",
        path: ["filters", "minArea"],
        message: "最小面积不能高于最大面积",
      });
    }
    for (const field of ["district", "minArea", "maxArea"] as const) {
      if (filters[field] !== null) {
        context.addIssue({
          code: "custom",
          path: ["filters", field],
          message: `${field} 暂不受当前历史数据支持`,
        });
      }
    }
  });

const rowSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().nullable(),
    city: z.string(),
    district: z.string().nullable(),
    address: z.string().nullable(),
    community: z.string().nullable(),
    price_monthly: finiteNumber.pipe(z.number().int().positive()),
    rent_type: z.string().nullable(),
    layout: z.string().nullable(),
    bedrooms: finiteNumber.pipe(z.number().int().min(0).max(20)).nullable(),
    area_sqm: finiteNumber.pipe(z.number().positive()).nullable(),
    floor: z.string().nullable(),
    orientation: z.string().nullable(),
    longitude: finiteNumber.pipe(z.number().min(-180).max(180)),
    latitude: finiteNumber.pipe(z.number().min(-90).max(90)),
    source_url: z.string().url().nullable(),
    dataset_period: z.literal(DATASET_PERIOD),
    source_label: z.string().min(1),
    disclaimer: z.string().min(1),
    distance_m: finiteNumber.pipe(z.number().nonnegative()),
    total_count: finiteNumber.pipe(z.number().int().nonnegative()),
  })
  .strict();

const detailRowSchema = rowSchema.omit({
  distance_m: true,
  total_count: true,
  source_label: true,
  disclaimer: true,
});

const DETAIL_COLUMNS =
  "id,title,city,district,address,community,price_monthly,rent_type,layout,bedrooms,area_sqm,floor,orientation,longitude,latitude,source_url,dataset_period";

interface HistoricalHousingSupabaseAdapterOptions {
  client: SupabaseClient;
  timeoutMs?: number;
}

function invalidArgument(cause: unknown): AppError {
  return new AppError({
    code: "HOUSING_INVALID_ARGUMENT",
    message: "历史房源查询条件无效或当前数据不支持该筛选",
    status: 400,
    retryable: false,
    cause,
  });
}

function bedroomsFromLayout(layout: string | null): number | null {
  if (layout === null) return null;
  return Number.parseInt(layout.match(/^(\d{1,2})室/u)![1]!, 10);
}

function mapRow(row: z.infer<typeof rowSchema>): HistoricalHousingItem {
  return {
    id: row.id,
    title: row.title,
    community: row.community,
    address: row.address,
    district: row.district,
    distanceM: row.distance_m,
    monthlyRent: row.price_monthly,
    rentType: row.rent_type,
    layout: row.layout,
    areaSqm: row.area_sqm,
    orientation: row.orientation,
    floor: row.floor,
    sourceUrl: row.source_url,
    location: {
      longitude: row.longitude,
      latitude: row.latitude,
    },
    datasetPeriod: row.dataset_period,
  };
}

function mapDetailRow(
  row: z.infer<typeof detailRowSchema>,
): HistoricalHousingDetail {
  return {
    id: row.id,
    title: row.title,
    community: row.community,
    address: row.address,
    district: row.district,
    monthlyRent: row.price_monthly,
    rentType: row.rent_type,
    layout: row.layout,
    areaSqm: row.area_sqm,
    orientation: row.orientation,
    floor: row.floor,
    sourceUrl: row.source_url,
    location: {
      longitude: row.longitude,
      latitude: row.latitude,
    },
    datasetPeriod: DATASET_PERIOD,
    sourceLabel: SOURCE_LABEL,
    disclaimer: DISCLAIMER,
  };
}

export class HistoricalHousingSupabaseAdapter implements HousingSearchService {
  private readonly client: SupabaseClient;
  private readonly timeoutMs: number;

  constructor(options: HistoricalHousingSupabaseAdapterOptions) {
    this.client = options.client;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async search(
    input: HousingSearchInput,
    signal?: AbortSignal,
  ): Promise<HistoricalHousingSearchResult> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw invalidArgument(parsed.error);

    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("housing Supabase query timeout"));
    }, this.timeoutMs);

    try {
      const value = parsed.data;
      const query = this.client
        .rpc("search_historical_houses", {
          p_city: value.city,
          p_min_price: value.filters.minPrice,
          p_max_price: value.filters.maxPrice,
          p_rent_type: value.filters.rentType,
          p_bedrooms: bedroomsFromLayout(value.filters.layout),
          p_center_longitude: value.center.longitude,
          p_center_latitude: value.center.latitude,
          p_radius_m: value.radiusM,
          p_sort: value.sort,
          p_offset: 0,
          p_limit: value.limit,
        })
        .abortSignal(controller.signal);
      const result = await query;
      if (result.error) {
        throw new AppError({
          code: "HOUSING_QUERY_FAILED",
          message: "历史房源查询暂时不可用",
          status: 502,
          retryable: true,
        });
      }

      const rows = z.array(rowSchema).safeParse(result.data ?? []);
      if (!rows.success) {
        throw new AppError({
          code: "HOUSING_INVALID_RESPONSE",
          message: "历史房源数据库返回了无效数据",
          status: 502,
          retryable: true,
        });
      }
      if (
        rows.data.some(
          (row) =>
            row.source_label !== SOURCE_LABEL ||
            row.disclaimer !== DISCLAIMER ||
            row.dataset_period !== DATASET_PERIOD,
        )
      ) {
        throw new AppError({
          code: "HOUSING_INVALID_RESPONSE",
          message: "历史房源数据版本信息不一致",
          status: 502,
          retryable: true,
        });
      }

      return {
        items: rows.data.map(mapRow),
        sourceLabel: rows.data[0]?.source_label ?? SOURCE_LABEL,
        datasetPeriod: DATASET_PERIOD,
        isHistorical: true,
        isRealtime: false,
        disclaimer: rows.data[0]?.disclaimer ?? DISCLAIMER,
        requestId,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        warnings: rows.data.length === 0 ? ["未找到符合条件的历史记录"] : [],
      };
    } catch (error) {
      if (signal?.aborted) {
        throw new AppError({
          code: "HOUSING_ABORTED",
          message: "历史房源查询已取消",
          status: 499,
          retryable: false,
        });
      }
      if (timedOut) {
        throw new AppError({
          code: "HOUSING_TIMEOUT",
          message: "历史房源数据库响应超时",
          status: 504,
          retryable: true,
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "HOUSING_QUERY_FAILED",
        message: "历史房源查询暂时不可用",
        status: 502,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async getById(
    id: string,
    signal?: AbortSignal,
  ): Promise<HistoricalHousingDetail | null> {
    const parsedId = z.uuid().safeParse(id);
    if (!parsedId.success) return null;

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("housing Supabase detail timeout"));
    }, this.timeoutMs);

    try {
      const result = await this.client
        .from("historical_houses")
        .select(DETAIL_COLUMNS)
        .eq("id", parsedId.data)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (result.error) {
        throw new AppError({
          code: "HOUSING_QUERY_FAILED",
          message: "历史房源详情暂时不可用",
          status: 502,
          retryable: true,
        });
      }
      if (!result.data) return null;
      const row = detailRowSchema.safeParse(result.data);
      if (!row.success) {
        throw new AppError({
          code: "HOUSING_INVALID_RESPONSE",
          message: "历史房源数据库返回了无效详情",
          status: 502,
          retryable: true,
          cause: row.error,
        });
      }
      return mapDetailRow(row.data);
    } catch (error) {
      if (signal?.aborted) {
        throw new AppError({
          code: "HOUSING_ABORTED",
          message: "历史房源详情查询已取消",
          cause: error,
        });
      }
      if (timedOut) {
        throw new AppError({
          code: "HOUSING_TIMEOUT",
          message: "历史房源详情查询超时",
          status: 504,
          retryable: true,
          cause: error,
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "HOUSING_QUERY_FAILED",
        message: "历史房源详情暂时不可用",
        status: 502,
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
