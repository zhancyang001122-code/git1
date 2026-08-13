export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface GeocodeInput {
  address: string;
  city?: string;
}

export interface ResolvedLocation {
  name: string;
  city: string;
  point: GeoPoint;
}

export interface NearbySearchInput {
  keyword: string;
  city?: string;
  center: GeoPoint;
  radiusM: number;
  limit: number;
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  category: string;
  distanceM: number;
  location: GeoPoint;
  source: "amap";
  isDemo: boolean;
}

export interface WalkingRouteInput {
  origin: GeoPoint;
  destination: GeoPoint;
}

export interface WalkingRouteStep {
  instruction: string;
  distanceM: number;
  durationSeconds: number;
}

export interface WalkingRouteResult {
  distanceM: number;
  durationSeconds: number;
  origin: GeoPoint;
  destination: GeoPoint;
  steps: readonly WalkingRouteStep[];
  source: "amap";
  isDemo: boolean;
}

export interface MapsService {
  convertGps(point: GeoPoint, signal?: AbortSignal): Promise<GeoPoint>;
  geocode(input: GeocodeInput, signal?: AbortSignal): Promise<GeoPoint | null>;
  reverseGeocode(
    point: GeoPoint,
    signal?: AbortSignal,
  ): Promise<Omit<ResolvedLocation, "point"> | null>;
  searchNearby(
    input: NearbySearchInput,
    signal?: AbortSignal,
  ): Promise<PlaceResult[]>;
  walkingRoute(
    input: WalkingRouteInput,
    signal?: AbortSignal,
  ): Promise<WalkingRouteResult | null>;
}
