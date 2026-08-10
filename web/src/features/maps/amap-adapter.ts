import "server-only";

import { z } from "zod";

import { parseCoordinate, serializeCoordinate } from "@/features/maps/schemas";
import type {
  GeoPoint,
  GeocodeInput,
  MapsService,
  NearbySearchInput,
  PlaceResult,
  WalkingRouteInput,
  WalkingRouteResult,
} from "@/features/maps/types";
import { AppError } from "@/lib/errors";

const envelopeSchema = z.object({
  status: z.string(),
  info: z.string(),
  infocode: z.string(),
});
const convertResponseSchema = envelopeSchema.extend({ locations: z.string() });
const geocodeResponseSchema = envelopeSchema.extend({
  geocodes: z
    .array(
      z.object({
        formatted_address: z.string(),
        location: z.string(),
      }),
    )
    .optional(),
});
const nearbyResponseSchema = envelopeSchema.extend({
  pois: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        address: z.union([z.string(), z.array(z.unknown())]),
        location: z.string(),
        distance: z.string(),
      }),
    )
    .optional(),
});
const routeResponseSchema = envelopeSchema.extend({
  route: z
    .object({
      paths: z
        .array(
          z.object({
            distance: z.string(),
            duration: z.string(),
            steps: z
              .array(
                z.object({
                  instruction: z.string(),
                  distance: z.string(),
                  duration: z.string(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

interface AmapAdapterOptions {
  key: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function serviceError(infocode: string): AppError {
  if (infocode === "10001" || infocode === "10002") {
    return new AppError({
      code: "AMAP_UNAUTHORIZED",
      message: "高德地图服务鉴权失败",
      status: 503,
    });
  }
  if (infocode === "10003" || infocode === "10004") {
    return new AppError({
      code: "AMAP_QUOTA",
      message: "高德地图调用额度或频率已受限",
      status: 503,
      retryable: true,
    });
  }
  return new AppError({
    code: "AMAP_INVALID_RESPONSE",
    message: "高德地图服务返回异常",
    status: 502,
    retryable: true,
  });
}

function numberField(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError({
      code: "AMAP_INVALID_RESPONSE",
      message: "高德地图返回了无法识别的数据",
      retryable: true,
    });
  }
  return parsed;
}

export class AmapAdapter implements MapsService {
  private readonly key: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: AmapAdapterOptions) {
    if (!options.key.trim()) {
      throw new AppError({
        code: "AMAP_NOT_CONFIGURED",
        message: "高德地图服务尚未配置",
        status: 503,
      });
    }
    this.key = options.key;
    this.baseUrl = options.baseUrl ?? "https://restapi.amap.com";
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.fetcher = options.fetcher ?? fetch;
  }

  private async request(
    path: string,
    params: URLSearchParams,
    signal?: AbortSignal,
  ) {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("amap timeout"));
    }, this.timeoutMs);
    params.set("key", this.key);
    const url = new URL(path, this.baseUrl);
    url.search = params.toString();
    try {
      const response = await this.fetcher(url, {
        method: "GET",
        signal: controller.signal,
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw serviceError(String(response.status));
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timedOut) {
        throw new AppError({
          code: "AMAP_TIMEOUT",
          message: "高德地图响应超时",
          retryable: true,
          cause: error,
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "AMAP_INVALID_RESPONSE",
        message: "高德地图服务暂时不可用",
        status: 502,
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async convertGps(point: GeoPoint, signal?: AbortSignal): Promise<GeoPoint> {
    const raw = await this.request(
      "/v3/assistant/coordinate/convert",
      new URLSearchParams({
        locations: serializeCoordinate(point),
        coordsys: "gps",
      }),
      signal,
    );
    const result = convertResponseSchema.safeParse(raw);
    if (!result.success) throw serviceError("invalid");
    if (result.data.status !== "1" || result.data.infocode !== "10000")
      throw serviceError(result.data.infocode);
    return parseCoordinate(result.data.locations);
  }

  async geocode(
    input: GeocodeInput,
    signal?: AbortSignal,
  ): Promise<GeoPoint | null> {
    const params = new URLSearchParams({ address: input.address });
    if (input.city) params.set("city", input.city);
    const raw = await this.request("/v3/geocode/geo", params, signal);
    const result = geocodeResponseSchema.safeParse(raw);
    if (!result.success) throw serviceError("invalid");
    if (result.data.status !== "1" || result.data.infocode !== "10000")
      throw serviceError(result.data.infocode);
    const first = result.data.geocodes?.[0];
    return first ? parseCoordinate(first.location) : null;
  }

  async searchNearby(
    input: NearbySearchInput,
    signal?: AbortSignal,
  ): Promise<PlaceResult[]> {
    const params = new URLSearchParams({
      keywords: input.keyword,
      location: serializeCoordinate(input.center),
      radius: String(input.radiusM),
      offset: String(input.limit),
      page: "1",
      extensions: "base",
    });
    if (input.city) {
      params.set("city", input.city);
      params.set("citylimit", "true");
    }
    const raw = await this.request("/v3/place/around", params, signal);
    const result = nearbyResponseSchema.safeParse(raw);
    if (!result.success) throw serviceError("invalid");
    if (result.data.status !== "1" || result.data.infocode !== "10000")
      throw serviceError(result.data.infocode);
    return (result.data.pois ?? []).slice(0, input.limit).map((poi) => ({
      id: poi.id,
      name: poi.name,
      address: typeof poi.address === "string" ? poi.address : "地址未提供",
      category: poi.type.split(";")[0] || "其他",
      distanceM: numberField(poi.distance),
      location: parseCoordinate(poi.location),
      source: "amap" as const,
      isDemo: false,
    }));
  }

  async walkingRoute(
    input: WalkingRouteInput,
    signal?: AbortSignal,
  ): Promise<WalkingRouteResult | null> {
    const params = new URLSearchParams({
      origin: serializeCoordinate(input.origin),
      destination: serializeCoordinate(input.destination),
    });
    const raw = await this.request("/v3/direction/walking", params, signal);
    const result = routeResponseSchema.safeParse(raw);
    if (!result.success) throw serviceError("invalid");
    if (result.data.status !== "1" || result.data.infocode !== "10000")
      throw serviceError(result.data.infocode);
    const path = result.data.route?.paths?.[0];
    if (!path) return null;
    return {
      distanceM: numberField(path.distance),
      durationSeconds: numberField(path.duration),
      origin: input.origin,
      destination: input.destination,
      steps: (path.steps ?? []).map((step) => ({
        instruction: step.instruction,
        distanceM: numberField(step.distance),
        durationSeconds: numberField(step.duration),
      })),
      source: "amap",
      isDemo: false,
    };
  }
}
