import { nearbyApiRequestSchema } from "@/features/maps/schemas";
import { createMapsRuntime, type MapsRuntime } from "@/features/maps/runtime";
import type {
  GeoPoint,
  PlaceResult,
  WalkingRouteResult,
} from "@/features/maps/types";
import { AppError, toPublicError } from "@/lib/errors";
import { requestIdFor } from "@/lib/request-id";

type MapsRuntimeFactory = () => Promise<MapsRuntime> | MapsRuntime;

function errorResponse(error: unknown, requestId: string): Response {
  const normalized = toPublicError(error, requestId);
  const status = error instanceof AppError ? error.status : 500;
  return Response.json(
    { error: normalized },
    { status, headers: { "x-request-id": requestId } },
  );
}

export function createNearbyMapsHandler(
  runtimeFactory: MapsRuntimeFactory = createMapsRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
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
      let data: PlaceResult[] | WalkingRouteResult | null;
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
      } else {
        data = await runtime.service.walkingRoute(
          {
            origin: parsed.data.origin,
            destination: parsed.data.destination,
          },
          request.signal,
        );
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

export const POST = createNearbyMapsHandler();
