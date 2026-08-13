"use client";

import { z } from "zod";

import {
  selectedLocationSchema,
  type SelectedLocation,
} from "@/features/location/selected-location";
import type { GeoPoint } from "@/features/maps/types";

const resolveResponseSchema = z.object({
  data: z.object({
    name: z.string(),
    city: z.string(),
    point: z.object({ longitude: z.number(), latitude: z.number() }),
    wgs84Point: z.object({ longitude: z.number(), latitude: z.number() }),
  }),
  mode: z.enum(["demo", "live"]),
  warning: z.string().optional(),
});

async function resolveRequest(
  body: Record<string, unknown>,
  source: SelectedLocation["source"],
): Promise<{ location: SelectedLocation; warning?: string }> {
  const response = await fetch("/api/maps/nearby", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const parsed = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(payload);
    throw new Error(
      parsed.success ? parsed.data.error.message : "地点解析失败，请稍后重试",
    );
  }
  const parsed = resolveResponseSchema.parse(payload);
  return {
    location: selectedLocationSchema.parse({ ...parsed.data, source }),
    ...(parsed.warning && { warning: parsed.warning }),
  };
}

export function resolveManualLocation(city: string, name: string) {
  return resolveRequest(
    { action: "resolve", kind: "manual", city, name },
    "manual",
  );
}

function browserPoint(): Promise<GeoPoint> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("当前浏览器不支持定位，请手动选择地点"));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        }),
      () => reject(new Error("定位权限未开启，请手动选择地点")),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  });
}

export async function resolveBrowserLocation() {
  const point = await browserPoint();
  return resolveRequest(
    { action: "resolve", kind: "browser", point },
    "browser",
  );
}
