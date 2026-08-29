import type { GeoPoint } from "@/features/maps/types";

const EARTH_RADIUS_M = 6_371_008.8;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

export function straightLineDistanceM(
  origin: GeoPoint,
  destination: GeoPoint,
): number {
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const originLatitude = radians(origin.latitude);
  const destinationLatitude = radians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Math.round(EARTH_RADIUS_M * centralAngle);
}

export function formatStraightLineDistance(distanceM: number): string {
  const safeDistance = Math.max(0, Math.round(distanceM));
  if (safeDistance > 10_000) return ">10km";
  if (safeDistance < 1_000) return `${safeDistance}m`;
  const kilometres = Number((safeDistance / 1_000).toFixed(1));
  return `${kilometres}km`;
}
