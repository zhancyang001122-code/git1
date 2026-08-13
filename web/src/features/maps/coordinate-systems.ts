import type { GeoPoint } from "@/features/maps/types";

const EARTH_RADIUS = 6_378_245;
const ECCENTRICITY_SQUARED = 0.006693421622965943;

function outsideChina(point: GeoPoint): boolean {
  return (
    point.longitude < 72.004 ||
    point.longitude > 137.8347 ||
    point.latitude < 0.8293 ||
    point.latitude > 55.8271
  );
}

function transformLatitude(longitude: number, latitude: number): number {
  let result =
    -100 +
    longitude * 2 +
    latitude * 3 +
    latitude * latitude * 0.2 +
    longitude * latitude * 0.1 +
    Math.sqrt(Math.abs(longitude)) * 0.2;
  result +=
    ((20 * Math.sin(6 * longitude * Math.PI) +
      20 * Math.sin(2 * longitude * Math.PI)) *
      2) /
    3;
  result +=
    ((20 * Math.sin(latitude * Math.PI) +
      40 * Math.sin((latitude / 3) * Math.PI)) *
      2) /
    3;
  result +=
    ((160 * Math.sin((latitude / 12) * Math.PI) +
      320 * Math.sin((latitude * Math.PI) / 30)) *
      2) /
    3;
  return result;
}

function transformLongitude(longitude: number, latitude: number): number {
  let result =
    300 +
    longitude +
    latitude * 2 +
    longitude * longitude * 0.1 +
    longitude * latitude * 0.1 +
    Math.sqrt(Math.abs(longitude)) * 0.1;
  result +=
    ((20 * Math.sin(6 * longitude * Math.PI) +
      20 * Math.sin(2 * longitude * Math.PI)) *
      2) /
    3;
  result +=
    ((20 * Math.sin(longitude * Math.PI) +
      40 * Math.sin((longitude / 3) * Math.PI)) *
      2) /
    3;
  result +=
    ((150 * Math.sin((longitude / 12) * Math.PI) +
      300 * Math.sin((longitude / 30) * Math.PI)) *
      2) /
    3;
  return result;
}

export function wgs84ToGcj02(point: GeoPoint): GeoPoint {
  if (outsideChina(point)) return point;
  const longitude = point.longitude - 105;
  const latitude = point.latitude - 35;
  let latitudeOffset = transformLatitude(longitude, latitude);
  let longitudeOffset = transformLongitude(longitude, latitude);
  const radianLatitude = (point.latitude / 180) * Math.PI;
  let magic = Math.sin(radianLatitude);
  magic = 1 - ECCENTRICITY_SQUARED * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  latitudeOffset =
    (latitudeOffset * 180) /
    (((EARTH_RADIUS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic)) *
      Math.PI);
  longitudeOffset =
    (longitudeOffset * 180) /
    ((EARTH_RADIUS / sqrtMagic) * Math.cos(radianLatitude) * Math.PI);
  return {
    longitude: point.longitude + longitudeOffset,
    latitude: point.latitude + latitudeOffset,
  };
}

/**
 * Iteratively reverses China's GCJ-02 offset. Four rounds are sufficient for
 * metre-level local search while keeping the conversion deterministic.
 */
export function gcj02ToWgs84(point: GeoPoint): GeoPoint {
  if (outsideChina(point)) return point;
  let estimate = { ...point };
  for (let index = 0; index < 4; index += 1) {
    const projected = wgs84ToGcj02(estimate);
    estimate = {
      longitude: estimate.longitude - (projected.longitude - point.longitude),
      latitude: estimate.latitude - (projected.latitude - point.latitude),
    };
  }
  return estimate;
}
