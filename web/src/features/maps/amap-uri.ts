import { wgs84ToGcj02 } from "@/features/maps/coordinate-systems";
import type { GeoPoint } from "@/features/maps/types";

export type AmapCoordinateSystem = "gcj02" | "wgs84";

export function buildAmapWalkingNavigationUrl(input: {
  destination: GeoPoint;
  destinationName: string;
  coordinateSystem?: AmapCoordinateSystem;
}): string {
  const point =
    input.coordinateSystem === "wgs84"
      ? wgs84ToGcj02(input.destination)
      : input.destination;
  const url = new URL("https://uri.amap.com/navigation");
  url.searchParams.set(
    "to",
    `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)},${input.destinationName}`,
  );
  url.searchParams.set("mode", "walk");
  url.searchParams.set("policy", "0");
  url.searchParams.set("src", "xiaozhi-local-life");
  url.searchParams.set("callnative", "0");
  return url.toString();
}
