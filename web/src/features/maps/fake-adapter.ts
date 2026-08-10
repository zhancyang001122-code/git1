import type {
  GeoPoint,
  GeocodeInput,
  MapsService,
  NearbySearchInput,
  PlaceResult,
  WalkingRouteInput,
  WalkingRouteResult,
} from "@/features/maps/types";

const WULIN_SQUARE: GeoPoint = { longitude: 120.163102, latitude: 30.274085 };

const demoPlaces: readonly Omit<PlaceResult, "distanceM">[] = [
  {
    id: "amap-demo-market-1",
    name: "武林生活超市（演示）",
    address: "体育场路演示地址 1 号",
    category: "购物服务",
    location: { longitude: 120.16421, latitude: 30.27331 },
    source: "amap",
    isDemo: true,
  },
  {
    id: "amap-demo-cafe-1",
    name: "湖畔咖啡（演示）",
    address: "延安路演示地址 2 号",
    category: "餐饮服务",
    location: { longitude: 120.16091, latitude: 30.27522 },
    source: "amap",
    isDemo: true,
  },
  {
    id: "amap-demo-hospital-1",
    name: "社区卫生服务点（演示）",
    address: "环城北路演示地址 3 号",
    category: "医疗保健服务",
    location: { longitude: 120.16631, latitude: 30.27612 },
    source: "amap",
    isDemo: true,
  },
];

function approximateDistance(left: GeoPoint, right: GeoPoint): number {
  const latitudeMeters = (left.latitude - right.latitude) * 111_000;
  const longitudeMeters =
    (left.longitude - right.longitude) *
    111_000 *
    Math.cos((left.latitude * Math.PI) / 180);
  return Math.round(Math.hypot(latitudeMeters, longitudeMeters));
}

export class FakeMapsService implements MapsService {
  async convertGps(point: GeoPoint): Promise<GeoPoint> {
    return point;
  }

  async geocode(input: GeocodeInput): Promise<GeoPoint | null> {
    return /武林广场/.test(input.address) ? WULIN_SQUARE : null;
  }

  async searchNearby(input: NearbySearchInput): Promise<PlaceResult[]> {
    const keyword = input.keyword.toLowerCase();
    const categoryMatches = (place: (typeof demoPlaces)[number]) => {
      if (/医院|医疗|卫生/.test(keyword))
        return place.category.includes("医疗");
      if (/咖啡|餐饮|饭店|美食/.test(keyword))
        return place.category.includes("餐饮");
      if (/超市|便利店|购物/.test(keyword))
        return place.category.includes("购物");
      return true;
    };
    return demoPlaces
      .filter(categoryMatches)
      .map((place) => ({
        ...place,
        distanceM: approximateDistance(input.center, place.location),
      }))
      .filter((place) => place.distanceM <= input.radiusM)
      .slice(0, input.limit);
  }

  async walkingRoute(input: WalkingRouteInput): Promise<WalkingRouteResult> {
    const straightLine = approximateDistance(input.origin, input.destination);
    const distanceM = Math.max(80, Math.round(straightLine * 1.22));
    return {
      distanceM,
      durationSeconds: Math.round(distanceM / 1.2),
      origin: input.origin,
      destination: input.destination,
      steps: [],
      source: "amap",
      isDemo: true,
    };
  }
}
