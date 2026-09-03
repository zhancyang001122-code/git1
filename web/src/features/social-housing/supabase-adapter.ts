import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { canonicalizeSocialPostUrl } from "@/features/social-housing/source-url";
import type {
  SocialHousingLeadDetail,
  SocialHousingLeadItem,
  SocialHousingSearchInput,
  SocialHousingSearchResult,
  SocialHousingSearchService,
} from "@/features/social-housing/types";
import { AppError } from "@/lib/errors";

const SOURCE_LABEL = "近期社交平台租房线索";
const DISCLAIMER = "来自公开帖子并经字段清洗，房态、身份和价格均未经核验";
const VERIFICATION_LABEL = "房态未经核验" as const;

const finiteNumber = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^-?\d+(?:\.\d+)?$/u),
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
    radiusM: z.number().int().min(100).max(5_000).nullable(),
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
    sort: z.enum(["distance", "price_asc", "price_desc", "published_desc"]),
    offset: z.number().int().min(0).max(100_000).default(0),
    limit: z.number().int().min(1).max(24),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.filters.minPrice !== null &&
      value.filters.maxPrice !== null &&
      value.filters.minPrice > value.filters.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["filters", "minPrice"],
        message: "最低租金不能高于最高租金",
      });
    }
    for (const field of ["district", "minArea", "maxArea"] as const) {
      if (value.filters[field] !== null) {
        context.addIssue({
          code: "custom",
          path: ["filters", field],
          message: `${field} 暂不受租房线索列表支持`,
        });
      }
    }
  });

const socialHousingPlatformSchema = z.enum(["xiaohongshu", "douyin"]);
const timestampSchema = z.iso.datetime({ offset: true });

const rowSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(160),
    summary: z.string().min(1).max(500),
    city: z.string().min(1).max(40),
    district: z.string().max(80).nullable(),
    community: z.string().max(200).nullable(),
    address: z.string().max(300).nullable(),
    price_min_monthly: finiteNumber.pipe(z.number().int().positive()),
    price_max_monthly: finiteNumber
      .pipe(z.number().int().positive())
      .nullable(),
    rent_type: z.string().max(40).nullable(),
    layout: z.string().max(80).nullable(),
    bedrooms: finiteNumber.pipe(z.number().int().min(0).max(20)).nullable(),
    area_sqm: finiteNumber.pipe(z.number().positive()).nullable(),
    longitude: finiteNumber.pipe(z.number().min(-180).max(180)),
    latitude: finiteNumber.pipe(z.number().min(-90).max(90)),
    coordinate_system: z.literal("wgs84"),
    published_at: timestampSchema,
    last_seen_at: timestampSchema,
    source_platforms: z.array(socialHousingPlatformSchema).min(1).max(2),
    source_count: finiteNumber.pipe(z.number().int().positive()),
    verification_label: z.literal(VERIFICATION_LABEL),
    distance_m: finiteNumber.pipe(z.number().nonnegative()),
    total_count: finiteNumber.pipe(z.number().int().nonnegative()),
  })
  .strict();

const sourceRowSchema = z
  .object({
    platform: socialHousingPlatformSchema,
    canonical_url: z.string().url().max(2_048),
    source_published_at: timestampSchema,
    last_checked_at: timestampSchema,
    source_status: z.enum(["not_obviously_closed", "closed", "unknown"]),
  })
  .strict();

const detailRowSchema = rowSchema
  .extend({
    distance_m: z.null(),
    total_count: z.null(),
    sources: z.array(sourceRowSchema).min(1).max(20),
  })
  .strict();

interface SocialHousingSupabaseAdapterOptions {
  client: SupabaseClient;
  timeoutMs?: number;
}

function invalidArgument(cause: unknown): AppError {
  return new AppError({
    code: "SOCIAL_HOUSING_INVALID_ARGUMENT",
    message: "近期租房线索查询条件无效",
    status: 400,
    retryable: false,
    cause,
  });
}

function bedroomsFromLayout(layout: string | null): number | null {
  if (layout === null) return null;
  return Number.parseInt(layout.match(/^(\d{1,2})室/u)![1]!, 10);
}

function mapRow(row: z.infer<typeof rowSchema>): SocialHousingLeadItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    community: row.community,
    address: row.address,
    district: row.district,
    distanceM: row.distance_m,
    monthlyRentMin: row.price_min_monthly,
    monthlyRentMax: row.price_max_monthly,
    rentType: row.rent_type,
    layout: row.layout,
    areaSqm: row.area_sqm,
    location: { longitude: row.longitude, latitude: row.latitude },
    coordinateSystem: row.coordinate_system,
    publishedAt: row.published_at,
    lastSeenAt: row.last_seen_at,
    sourcePlatforms: row.source_platforms,
    sourceCount: row.source_count,
    verificationLabel: row.verification_label,
  };
}

function mapDetailRow(
  row: z.infer<typeof detailRowSchema>,
): SocialHousingLeadDetail {
  const {
    distance_m: _distance,
    sources,
    total_count: _total,
    ...baseRow
  } = row;
  void _distance;
  void _total;
  return {
    ...mapRow({ ...baseRow, distance_m: 0, total_count: 1 }),
    sources: sources.map((source) => {
      const canonical = canonicalizeSocialPostUrl(source.canonical_url);
      if (canonical.platform !== source.platform) {
        throw new AppError({
          code: "SOCIAL_HOUSING_INVALID_RESPONSE",
          message: "租房线索来源格式无效",
          status: 502,
          retryable: true,
        });
      }
      return {
        platform: source.platform,
        canonicalUrl: canonical.canonicalUrl,
        sourcePublishedAt: source.source_published_at,
        lastCheckedAt: source.last_checked_at,
        sourceStatus: source.source_status,
      };
    }),
    sourceLabel: SOURCE_LABEL,
    disclaimer: DISCLAIMER,
  };
}

export class SocialHousingSupabaseAdapter implements SocialHousingSearchService {
  private readonly client: SupabaseClient;
  private readonly timeoutMs: number;

  constructor(options: SocialHousingSupabaseAdapterOptions) {
    this.client = options.client;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async search(
    input: SocialHousingSearchInput,
    signal?: AbortSignal,
  ): Promise<SocialHousingSearchResult> {
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
      controller.abort(new Error("social housing query timeout"));
    }, this.timeoutMs);

    try {
      const value = parsed.data;
      const query = this.client
        .rpc("search_social_housing_leads", {
          p_city: value.city,
          p_min_price: value.filters.minPrice,
          p_max_price: value.filters.maxPrice,
          p_rent_type: value.filters.rentType,
          p_bedrooms: bedroomsFromLayout(value.filters.layout),
          p_center_longitude: value.center.longitude,
          p_center_latitude: value.center.latitude,
          p_radius_m: value.radiusM,
          p_sort: value.sort,
          p_offset: value.offset,
          p_limit: value.limit,
        })
        .abortSignal(controller.signal);
      const result = await query;
      if (result.error) {
        throw new AppError({
          code: "SOCIAL_HOUSING_QUERY_FAILED",
          message: "近期租房线索查询暂时不可用",
          status: 502,
          retryable: true,
        });
      }
      const rows = z.array(rowSchema).safeParse(result.data ?? []);
      if (!rows.success) {
        throw new AppError({
          code: "SOCIAL_HOUSING_INVALID_RESPONSE",
          message: "租房线索数据库返回了无效数据",
          status: 502,
          retryable: true,
          cause: rows.error,
        });
      }
      const total = rows.data[0]?.total_count ?? 0;
      const nextOffset = value.offset + rows.data.length;
      return {
        items: rows.data.map(mapRow),
        total,
        nextCursor:
          rows.data.length > 0 && nextOffset < total
            ? `offset:${nextOffset}`
            : null,
        sourceLabel: SOURCE_LABEL,
        disclaimer: DISCLAIMER,
        requestId,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        warnings:
          rows.data.length === 0 ? ["暂无已通过展示审核的近期线索"] : [],
      };
    } catch (error) {
      if (signal?.aborted) {
        throw new AppError({
          code: "SOCIAL_HOUSING_ABORTED",
          message: "近期租房线索查询已取消",
          status: 499,
          retryable: false,
        });
      }
      if (timedOut) {
        throw new AppError({
          code: "SOCIAL_HOUSING_TIMEOUT",
          message: "近期租房线索数据库响应超时",
          status: 504,
          retryable: true,
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "SOCIAL_HOUSING_QUERY_FAILED",
        message: "近期租房线索查询暂时不可用",
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
  ): Promise<SocialHousingLeadDetail | null> {
    const parsedId = z.uuid().safeParse(id);
    if (!parsedId.success) return null;

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("social housing detail timeout"));
    }, this.timeoutMs);

    try {
      const query = this.client
        .rpc("get_social_housing_lead_detail", { p_id: parsedId.data })
        .abortSignal(controller.signal);
      const result = await query;
      if (result.error) {
        throw new AppError({
          code: "SOCIAL_HOUSING_QUERY_FAILED",
          message: "租房线索详情暂时不可用",
          status: 502,
          retryable: true,
        });
      }
      const rows = z
        .array(detailRowSchema)
        .max(1)
        .safeParse(result.data ?? []);
      if (!rows.success) {
        throw new AppError({
          code: "SOCIAL_HOUSING_INVALID_RESPONSE",
          message: "租房线索数据库返回了无效详情",
          status: 502,
          retryable: true,
          cause: rows.error,
        });
      }
      return rows.data[0] ? mapDetailRow(rows.data[0]) : null;
    } catch (error) {
      if (signal?.aborted) {
        throw new AppError({
          code: "SOCIAL_HOUSING_ABORTED",
          message: "租房线索详情查询已取消",
          status: 499,
          retryable: false,
        });
      }
      if (timedOut) {
        throw new AppError({
          code: "SOCIAL_HOUSING_TIMEOUT",
          message: "租房线索详情查询超时",
          status: 504,
          retryable: true,
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "SOCIAL_HOUSING_QUERY_FAILED",
        message: "租房线索详情暂时不可用",
        status: 502,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
