"use client";

import {
  Bot,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { LocationPickerSheet } from "@/components/location/location-picker-sheet";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import { resolveBrowserLocation } from "@/features/location/location-client";
import {
  selectedLocationLabel,
  type SelectedLocation,
} from "@/features/location/selected-location";
import { useSelectedLocation } from "@/features/location/selected-location-provider";
import type { GeoPoint, PlaceResult } from "@/features/maps/types";

const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  category: z.string(),
  distanceM: z.number().nonnegative(),
  location: z.object({ longitude: z.number(), latitude: z.number() }),
  source: z.literal("amap"),
  isDemo: z.boolean(),
});
const searchResponseSchema = z.object({
  data: z.array(placeSchema),
  center: z.object({ longitude: z.number(), latitude: z.number() }),
  mode: z.enum(["demo", "live"]),
  warning: z.string().optional(),
});
const routeResponseSchema = z.object({
  data: z
    .object({
      distanceM: z.number().nonnegative(),
      durationSeconds: z.number().nonnegative(),
      isDemo: z.boolean(),
    })
    .nullable(),
  mode: z.enum(["demo", "live"]),
  warning: z.string().optional(),
});

const categories = ["超市", "餐饮", "咖啡", "医院"] as const;

export function NearbyExperience() {
  const { location, ready, setLocation } = useSelectedLocation();
  const [category, setCategory] = useState<(typeof categories)[number]>("超市");
  const [center, setCenter] = useState<GeoPoint | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [places, setPlaces] = useState<readonly PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const searchedLocationKey = useRef<string | null>(null);
  const [lastSearch, setLastSearch] = useState<{
    location: SelectedLocation;
    category: (typeof categories)[number];
  } | null>(null);

  const search = useCallback(
    async (
      selected: SelectedLocation,
      nextCategory: (typeof categories)[number],
    ) => {
      const point = selected.point;
      setLastSearch({
        location: selected,
        category: nextCategory,
      });
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/maps/nearby", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "search",
            keyword: nextCategory,
            city: selected.city,
            center: point,
            coordinateSystem: "amap",
            radiusM: 2000,
            limit: 6,
          }),
        });
        const body: unknown = await response.json();
        if (!response.ok) {
          const message = z
            .object({ error: z.object({ message: z.string() }) })
            .safeParse(body);
          throw new Error(
            message.success ? message.data.error.message : "周边查询失败",
          );
        }
        const parsed = searchResponseSchema.parse(body);
        setCenter(parsed.center);
        setPlaces(parsed.data);
        if (parsed.warning)
          setNotice((current) =>
            current && current !== parsed.warning
              ? `${current}；${parsed.warning}`
              : (parsed.warning ?? current),
          );
      } catch (caught) {
        setPlaces([]);
        setError(caught instanceof Error ? caught.message : "周边查询失败");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  async function handleBrowserLocation() {
    setLocating(true);
    setError(null);
    try {
      const result = await resolveBrowserLocation();
      setLocation(result.location);
      setNotice(
        result.warning ??
          "已更新全站查询位置；浏览器 GPS 已在服务端转换为高德坐标。",
      );
    } catch (caught) {
      setNotice(
        `${caught instanceof Error ? caught.message : "定位失败"}，继续使用${selectedLocationLabel(location)}。`,
      );
      await search(location, category);
    } finally {
      setLocating(false);
    }
  }

  async function changeCategory(next: (typeof categories)[number]) {
    setCategory(next);
    if (center) await search(location, next);
  }

  useEffect(() => {
    if (!ready) return;
    const key = `${location.city}:${location.name}:${location.point.longitude}:${location.point.latitude}:${location.source}`;
    if (location.source === "default" || searchedLocationKey.current === key)
      return;
    searchedLocationKey.current = key;
    void search(location, category);
  }, [category, location, ready, search]);

  async function calculateRoute(place: PlaceResult) {
    if (!center) return;
    setRoutes((current) => ({ ...current, [place.id]: "正在计算…" }));
    try {
      const response = await fetch("/api/maps/nearby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "route",
          origin: center,
          destination: place.location,
        }),
      });
      const body = routeResponseSchema.parse(await response.json());
      if (!response.ok || !body.data) throw new Error("没有可用路线");
      const route = body.data;
      const minutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
      setRoutes((current) => ({
        ...current,
        [place.id]: `步行 ${route.distanceM} 米 · 约 ${minutes} 分钟${route.isDemo ? "（演示）" : ""}`,
      }));
    } catch {
      setRoutes((current) => ({ ...current, [place.id]: "路线暂不可用" }));
    }
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {notice ? <DemoNotice>{notice}</DemoNotice> : null}
      <section className="rounded-feature bg-gradient-to-br from-brand-soft to-accent/10 p-5 text-center">
        <MapPinned className="mx-auto size-8 text-brand" />
        <h2 className="mt-3 text-lg font-semibold text-text">
          {selectedLocationLabel(location)}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          只有你主动点击后，浏览器才会请求定位权限
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleBrowserLocation()}
            disabled={loading || locating}
            className="flex min-h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-card bg-brand px-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <LocateFixed className="size-4" />
            {locating ? "正在定位" : "使用我的位置"}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={loading || locating}
            className="flex min-h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-card border border-border bg-surface px-2 text-sm font-semibold text-text disabled:opacity-60"
          >
            <MapPin className="size-4" />
            手动选择地点
          </button>
        </div>
        <button
          type="button"
          onClick={() => void search(location, category)}
          disabled={loading || locating}
          className="mt-3 min-h-11 w-full rounded-control text-sm font-medium text-brand outline-none hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
        >
          查询当前地点周边
        </button>
      </section>

      {pickerOpen ? (
        <LocationPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelected={(_selected, warning) => {
            setNotice(warning ?? "已更新全站查询位置，并自动查询当前分类。");
          }}
        />
      ) : null}

      <section aria-label="周边分类">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => void changeCategory(item)}
              aria-pressed={category === item}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand ${category === item ? "bg-brand text-white" : "bg-surface-tint text-text-muted"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">周边结果</h2>
        <Link
          href={`/xiaozhi/chat?prompt=${encodeURIComponent(`帮我找附近${category}`)}&source=nearby`}
          className="flex items-center gap-1 text-sm font-medium text-brand"
        >
          <Bot className="size-4" />
          问小智
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-text-muted">
          <LoaderCircle className="size-5 animate-spin" /> 正在查询周边地点
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-card border border-danger/20 bg-danger/5 p-4 text-sm text-danger"
        >
          <p>{error}</p>
          {lastSearch ? (
            <button
              type="button"
              onClick={() =>
                void search(lastSearch.location, lastSearch.category)
              }
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-control border border-danger/20 bg-surface px-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-danger"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              重试周边查询
            </button>
          ) : null}
        </div>
      ) : places.length > 0 ? (
        <div className="space-y-3">
          {places.map((place) => (
            <article
              key={place.id}
              className="rounded-card border border-border bg-surface p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Tag>{place.category}</Tag>
                  <h3 className="mt-2 text-base font-semibold text-text">
                    {place.name}
                  </h3>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brand">
                  {place.distanceM} 米
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{place.address}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SourceBadge source="amap" />
                {place.isDemo ? <Tag>接口演示数据</Tag> : null}
              </div>
              <button
                type="button"
                onClick={() => void calculateRoute(place)}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-surface-tint text-sm font-medium text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Navigation className="size-4" />
                {routes[place.id] ?? "计算步行路线"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
          选择定位方式后，才会查询真实地图服务或明确标注的接口演示数据。
        </div>
      )}
    </div>
  );
}
