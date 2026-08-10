import "server-only";

import { z } from "zod";

import type {
  HistoricalHousingSearchResult,
  HousingSearchInput,
  HousingSearchService,
} from "@/features/housing/types";
import { AppError } from "@/lib/errors";
import {
  createCircuitBreaker,
  retryTransient,
  type CircuitBreaker,
} from "@/lib/resilience";

const houseItemSchema = z
  .object({
    listing_id: z.string().min(1),
    title: z.string(),
    community: z.string(),
    address: z.string(),
    district: z.string(),
    distance_m: z.number().nonnegative(),
    monthly_rent: z.number().nonnegative(),
    rent_type: z.string(),
    layout: z.string(),
    area_sqm: z.number().nonnegative(),
    orientation: z.string(),
    floor: z.string(),
    source_url: z.string().url().nullable().optional(),
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  })
  .strict();

const successSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        returned_count: z.number().int().nonnegative(),
        items: z.array(houseItemSchema).max(10),
      })
      .strict(),
    source: z
      .object({
        label: z.string(),
        dataset_period: z.literal("2024-11"),
        is_historical: z.literal(true),
        is_realtime: z.literal(false),
        disclaimer: z.string(),
      })
      .strict(),
    meta: z
      .object({
        request_id: z.string().min(1),
        duration_ms: z.number().int().nonnegative(),
        warnings: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

const errorSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        retryable: z.boolean(),
      })
      .strict(),
    meta: z.object({ request_id: z.string().min(1) }).strict(),
  })
  .strict();

interface HousingHttpAdapterOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  circuitBreaker?: CircuitBreaker;
}

const sharedCircuitBreaker = createCircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 30_000,
});

function normalizedServiceError(status: number, raw: unknown): AppError {
  const parsed = errorSchema.safeParse(raw);
  if (!parsed.success) {
    return new AppError({
      code: "HOUSING_INVALID_RESPONSE",
      message: "历史房源服务返回了无法识别的错误",
      status: 502,
      retryable: status >= 500,
      cause: parsed.error,
    });
  }
  const knownCodes = new Set([
    "INVALID_ARGUMENT",
    "UNSUPPORTED_CITY",
    "UNAUTHORIZED",
    "RATE_LIMITED",
    "DATA_UNAVAILABLE",
    "INTERNAL_ERROR",
    "PAYLOAD_TOO_LARGE",
  ]);
  const code = knownCodes.has(parsed.data.error.code)
    ? `HOUSING_${parsed.data.error.code}`
    : "HOUSING_UPSTREAM_ERROR";
  return new AppError({
    code,
    message:
      code === "HOUSING_UNAUTHORIZED"
        ? "历史房源服务鉴权失败"
        : parsed.data.error.message,
    status: status >= 400 && status <= 599 ? status : 502,
    retryable: parsed.data.error.retryable,
  });
}

export class HousingHttpAdapter implements HousingSearchService {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(options: HousingHttpAdapterOptions) {
    let baseUrl: URL;
    try {
      baseUrl = new URL(options.baseUrl);
    } catch (error) {
      throw new AppError({
        code: "HOUSING_NOT_CONFIGURED",
        message: "历史房源服务地址无效",
        status: 503,
        cause: error,
      });
    }
    if (!new Set(["http:", "https:"]).has(baseUrl.protocol)) {
      throw new AppError({
        code: "HOUSING_NOT_CONFIGURED",
        message: "历史房源服务地址必须使用 HTTP 或 HTTPS",
        status: 503,
      });
    }
    if (options.apiKey.length < 32) {
      throw new AppError({
        code: "HOUSING_NOT_CONFIGURED",
        message: "历史房源服务密钥长度不足",
        status: 503,
      });
    }
    this.baseUrl = baseUrl;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.fetcher = options.fetcher ?? fetch;
    this.circuitBreaker = options.circuitBreaker ?? sharedCircuitBreaker;
  }

  async search(
    input: HousingSearchInput,
    signal?: AbortSignal,
  ): Promise<HistoricalHousingSearchResult> {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("housing service timeout"));
    }, this.timeoutMs);
    const url = new URL("/v1/houses/search", this.baseUrl);
    const body = {
      city: input.city,
      center: {
        lat: input.center.latitude,
        lng: input.center.longitude,
        coordinate_system: "WGS84",
        label: input.center.label,
      },
      radius_m: input.radiusM,
      filters: {
        price_min: input.filters.minPrice,
        price_max: input.filters.maxPrice,
        rent_type: input.filters.rentType,
        layout: input.filters.layout,
        area_min: input.filters.minArea,
        area_max: input.filters.maxArea,
        district: input.filters.district,
      },
      sort: input.sort,
      limit: input.limit,
    };

    try {
      const raw = await this.circuitBreaker.execute(() =>
        retryTransient(
          async () => {
            try {
              const response = await this.fetcher(url, {
                method: "POST",
                headers: {
                  accept: "application/json",
                  "content-type": "application/json",
                  authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                cache: "no-store",
                signal: controller.signal,
              });
              const value: unknown = await response.json();
              if (!response.ok) throw normalizedServiceError(response.status, value);
              return value;
            } catch (error) {
              if (error instanceof AppError) throw error;
              if (controller.signal.aborted) throw error;
              throw new AppError({
                code: "HOUSING_UNAVAILABLE",
                message: "历史房源服务暂时不可用",
                status: 502,
                retryable: true,
                cause: error,
              });
            }
          },
          { retries: 1 },
        ),
      );
      const parsed = successSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AppError({
          code: "HOUSING_INVALID_RESPONSE",
          message: "历史房源服务返回了无法识别的数据",
          status: 502,
          retryable: true,
          cause: parsed.error,
        });
      }
      if (parsed.data.data.returned_count !== parsed.data.data.items.length) {
        throw new AppError({
          code: "HOUSING_INVALID_RESPONSE",
          message: "历史房源服务返回数量不一致",
          status: 502,
          retryable: true,
        });
      }
      return {
        items: parsed.data.data.items.map((item) => ({
          id: item.listing_id,
          title: item.title,
          community: item.community,
          address: item.address,
          district: item.district,
          distanceM: item.distance_m,
          monthlyRent: item.monthly_rent,
          rentType: item.rent_type,
          layout: item.layout,
          areaSqm: item.area_sqm,
          orientation: item.orientation,
          floor: item.floor,
          sourceUrl: item.source_url ?? null,
          location: {
            longitude: item.longitude,
            latitude: item.latitude,
          },
          petsPolicy: "unknown" as const,
          datasetPeriod: "2024-11" as const,
        })),
        sourceLabel: parsed.data.source.label,
        datasetPeriod: parsed.data.source.dataset_period,
        isHistorical: true,
        isRealtime: false,
        disclaimer: parsed.data.source.disclaimer,
        requestId: parsed.data.meta.request_id,
        durationMs: parsed.data.meta.duration_ms,
        warnings: parsed.data.meta.warnings,
      };
    } catch (error) {
      if (signal?.aborted) {
        throw new AppError({
          code: "HOUSING_ABORTED",
          message: "历史房源查询已取消",
          cause: error,
        });
      }
      if (timedOut) {
        throw new AppError({
          code: "HOUSING_TIMEOUT",
          message: "历史房源服务响应超时",
          status: 504,
          retryable: true,
          cause: error,
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "HOUSING_UNAVAILABLE",
        message: "历史房源服务暂时不可用",
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
