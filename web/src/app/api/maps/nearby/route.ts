import { nearbyApiRequestSchema } from "@/features/maps/schemas";
import { gcj02ToWgs84 } from "@/features/maps/coordinate-systems";
import { createMapsRuntime, type MapsRuntime } from "@/features/maps/runtime";
import type {
  GeoPoint,
  PlaceResult,
  WalkingRouteResult,
} from "@/features/maps/types";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import { createEnvironmentFixedWindowRateLimiter } from "@/lib/distributed-rate-limit";
import { AppError, toPublicError } from "@/lib/errors";
import { requestClientKey, type RateLimiter } from "@/lib/rate-limit";
import { requestIdFor } from "@/lib/request-id";
import { observeRoute } from "@/lib/route-observability";

type MapsRuntimeFactory = () => Promise<MapsRuntime> | MapsRuntime;

const mapsRateLimiter = createEnvironmentFixedWindowRateLimiter({
  scope: "maps_nearby_ip",
  limit: 30,
  windowMs: 60_000,
});

function errorResponse(error: unknown, requestId: string): Response {
  const normalized = toPublicError(error, requestId);
  const status = error instanceof AppError ? error.status : 500;
  return Response.json(
    { error: normalized },
    {
      status,
      headers: { "x-error-code": normalized.code, "x-request-id": requestId },
    },
  );
}

export function createNearbyMapsHandler(
  runtimeFactory: MapsRuntimeFactory = createMapsRuntime,
  rateLimiter: RateLimiter = mapsRateLimiter,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const rateLimit = await rateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
    let body: unknown;
    try {
      body = await readJsonWithLimit(request, 8_192);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "REQUEST_BODY_TOO_LARGE"
      ) {
        return errorResponse(error, requestId);
      }
      return errorResponse(
        new AppError({
          code: "INVALID_MAP_REQUEST",
          message: "地图请求格式无效",
          status: 400,
          cause: error,
        }),
        requestId,
      );
    }
    const parsed = nearbyApiRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        new AppError({
          code: "INVALID_MAP_REQUEST",
          message: "地图请求参数无效",
          status: 400,
          cause: parsed.error,
        }),
        requestId,
      );
    }

    try {
      const runtime = await runtimeFactory();
      let center: GeoPoint | undefined;
      let data:
        | PlaceResult[]
        | WalkingRouteResult
        | {
            name: string;
            city: string;
            point: GeoPoint;
            wgs84Point: GeoPoint;
          }
        | null;
      if (parsed.data.action === "search") {
        const search = parsed.data;
        center =
          search.coordinateSystem === "gps"
            ? await runtime.service.convertGps(search.center, request.signal)
            : search.center;
        data = await runtime.service.searchNearby(
          {
            keyword: search.keyword,
            city: search.city,
            center,
            radiusM: search.radiusM,
            limit: search.limit,
          },
          request.signal,
        );
      } else if (parsed.data.action === "route") {
        data = await runtime.service.walkingRoute(
          {
            origin: parsed.data.origin,
            destination: parsed.data.destination,
          },
          request.signal,
        );
      } else if (parsed.data.kind === "manual") {
        const point = await runtime.service.geocode(
          { address: parsed.data.name, city: parsed.data.city },
          request.signal,
        );
        if (!point) {
          throw new AppError({
            code: "AMAP_NO_RESULT",
            message: "没有识别到这个地点，请补充城市或更具体的名称",
            status: 404,
          });
        }
        data = {
          name: parsed.data.name,
          city: parsed.data.city,
          point,
          wgs84Point: gcj02ToWgs84(point),
        };
      } else {
        const point = await runtime.service.convertGps(
          parsed.data.point,
          request.signal,
        );
        const address = await runtime.service.reverseGeocode(
          point,
          request.signal,
        );
        if (!address) {
          throw new AppError({
            code: "AMAP_NO_RESULT",
            message: "暂时无法识别当前位置",
            status: 404,
          });
        }
        data = { ...address, point, wgs84Point: parsed.data.point };
      }
      return Response.json(
        {
          data,
          ...(center !== undefined && { center }),
          mode: runtime.mode,
          ...(runtime.mode === "demo" && {
            warning: "当前为高德接口演示数据，未发起实时调用",
          }),
        },
        { headers: { "x-request-id": requestId } },
      );
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export const POST = observeRoute("/api/maps/nearby", createNearbyMapsHandler());
