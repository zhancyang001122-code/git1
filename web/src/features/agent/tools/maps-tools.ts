import type { ResultCard } from "@/features/agent/chat-events";
import type { ToolInputs, ToolName } from "@/features/agent/tools/schemas";
import {
  toolContractDefinitions,
  toolInputSchemas,
} from "@/features/agent/tools/schemas";
import type {
  ErasedToolDefinition,
  ToolDefinition,
  ToolResult,
} from "@/features/agent/tools/types";
import type { PlaceResult } from "@/features/maps/types";

function contract(name: ToolName) {
  return toolContractDefinitions.find(
    (definition) => definition.name === name,
  )!;
}

function failure<T>(code: string, message: string): ToolResult<T> {
  return {
    ok: false,
    error: { code, message, retryable: false },
    source: "amap",
    resultCount: 0,
  };
}

function placeView(place: PlaceResult): Record<string, unknown> {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    distanceM: place.distanceM,
    location: place.location,
    source: place.source,
    isDemo: place.isDemo,
  };
}

const searchNearbyPlaces: ToolDefinition<ToolInputs["search_nearby_places"]> = {
  ...contract("search_nearby_places"),
  publicLabel: "正在查询周边地点",
  source: () => "amap",
  inputSchema: toolInputSchemas.search_nearby_places,
  async execute(input, context) {
    const center =
      input.center_name !== null
        ? await context.maps.geocode(
            { address: input.center_name, city: input.city },
            context.signal,
          )
        : input.longitude !== null && input.latitude !== null
          ? { longitude: input.longitude, latitude: input.latitude }
          : null;
    if (!center) return failure("AMAP_NO_RESULT", "高德地图没有识别到查询中心");
    const places = await context.maps.searchNearby(
      {
        keyword: input.keyword,
        city: input.city,
        center,
        radiusM: input.radius_m,
        limit: input.limit,
      },
      context.signal,
    );
    if (places.length === 0)
      return failure("AMAP_NO_RESULT", "附近没有找到符合条件的地点");
    const items = places.map(placeView);
    const cards: ResultCard[] = items.map((data) => ({ kind: "place", data }));
    return {
      ok: true,
      data: {
        items,
        center,
        source: "amap",
        isDemo: places.every((place) => place.isDemo),
      },
      source: "amap",
      cards,
      resultCount: items.length,
    };
  },
};

const calculateWalkingRoute: ToolDefinition<
  ToolInputs["calculate_walking_route"]
> = {
  ...contract("calculate_walking_route"),
  publicLabel: "正在计算步行路线",
  source: () => "amap",
  inputSchema: toolInputSchemas.calculate_walking_route,
  async execute(input, context) {
    const route = await context.maps.walkingRoute(
      {
        origin: {
          longitude: input.origin_longitude,
          latitude: input.origin_latitude,
        },
        destination: {
          longitude: input.destination_longitude,
          latitude: input.destination_latitude,
        },
      },
      context.signal,
    );
    if (!route)
      return failure("AMAP_NO_RESULT", "高德地图没有返回可用步行路线");
    return {
      ok: true,
      data: route,
      source: "amap",
      resultCount: 1,
    };
  },
};

export const mapToolDefinitions: readonly ErasedToolDefinition[] = [
  searchNearbyPlaces,
  calculateWalkingRoute,
] as unknown as readonly ErasedToolDefinition[];
