"use client";

import {
  ArrowUpDown,
  Bot,
  Check,
  Heart,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  HouseCard,
  type HouseCardData,
} from "@/components/business/house-card";
import { SelectedLocationBar } from "@/components/location/selected-location-bar";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Toast } from "@/components/ui/toast";
import {
  historicalHousingListResponseSchema,
  type HistoricalHousingListResponse,
} from "@/features/housing/list-contract";
import type { HistoricalHousingItem } from "@/features/housing/types";
import { useSelectedLocation } from "@/features/location/selected-location-provider";
import { cn } from "@/lib/cn";

const roomTypes = ["全部户型", "一居室", "两居室", "开间", "合租"] as const;
type RoomType = (typeof roomTypes)[number];
type HistoricalHouseSort =
  "distance_asc" | "price_asc" | "price_desc" | "area_desc";

const sortLabels: Record<HistoricalHouseSort, string> = {
  distance_asc: "距离最近",
  price_asc: "租金从低到高",
  price_desc: "租金从高到低",
  area_desc: "面积从大到小",
};

function chipClass(active: boolean) {
  return cn(
    "ui-interactive min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium outline-none",
    active
      ? "border-brand bg-brand text-white"
      : "glass-control text-text-muted hover:bg-brand-soft",
  );
}

function cardData(item: HistoricalHousingItem): HouseCardData {
  return {
    id: item.id,
    name: item.title ?? item.community ?? "房源标题暂无记录",
    priceMonthly: item.monthlyRent,
    roomType: item.layout ?? item.rentType,
    areaSqm: item.areaSqm,
    district: item.district,
    address: item.address ?? item.community,
    imageSrc: "/images/home/housing-history-2024.webp",
    isDemo: false,
  };
}

async function requestHistoricalHouses(options: {
  city: string;
  longitude: number;
  latitude: number;
  locationLabel: string;
  budgetOnly: boolean;
  roomType: RoomType;
  sort: HistoricalHouseSort;
  cursor?: string;
  signal?: AbortSignal;
}): Promise<HistoricalHousingListResponse> {
  const parameters = new URLSearchParams({
    city: options.city,
    longitude: String(options.longitude),
    latitude: String(options.latitude),
    locationLabel: options.locationLabel,
    sort: options.sort,
    limit: "24",
  });
  if (options.budgetOnly) parameters.set("maxPrice", "3500");
  if (options.roomType !== "全部户型") {
    parameters.set("roomType", options.roomType);
  }
  if (options.cursor) parameters.set("cursor", options.cursor);

  const response = await fetch(`/api/houses?${parameters}`, {
    cache: "no-store",
    signal: options.signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "历史房源查询失败，请稍后重试";
    throw new Error(message);
  }
  const parsed = historicalHousingListResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("历史房源返回格式无效，请稍后重试");
  return parsed.data;
}

export function HistoricalHouseListExperience() {
  const { location } = useSelectedLocation();
  const [roomType, setRoomType] = useState<RoomType>("全部户型");
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [sort, setSort] = useState<HistoricalHouseSort>("distance_asc");
  const [queryState, setQueryState] = useState<{
    key: string;
    items: readonly HistoricalHousingItem[];
    total: number;
    nextCursor: string | null;
    error: string | null;
  }>({ key: "", items: [], total: 0, nextCursor: null, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);

  const activeFilterCount = [roomType !== "全部户型", budgetOnly].filter(
    Boolean,
  ).length;
  const queryKey = JSON.stringify({
    budgetOnly,
    city: location.city,
    latitude: location.wgs84Point.latitude,
    locationName: location.name,
    longitude: location.wgs84Point.longitude,
    reloadKey,
    roomType,
    sort,
  });
  const unsupportedCityMessage =
    location.city === "杭州"
      ? null
      : "2024-11 历史房源目前只覆盖杭州，请先把定位切换到杭州。";
  const querySettled = queryState.key === queryKey;
  const loading = unsupportedCityMessage === null && !querySettled;
  const items = querySettled ? queryState.items : [];
  const total = querySettled ? queryState.total : 0;
  const nextCursor = querySettled ? queryState.nextCursor : null;
  const error =
    unsupportedCityMessage ?? (querySettled ? queryState.error : null);

  useEffect(() => {
    if (location.city !== "杭州") return;

    const controller = new AbortController();
    void requestHistoricalHouses({
      city: location.city,
      longitude: location.wgs84Point.longitude,
      latitude: location.wgs84Point.latitude,
      locationLabel: location.name,
      budgetOnly,
      roomType,
      sort,
      signal: controller.signal,
    })
      .then((result) => {
        setQueryState({
          key: queryKey,
          items: result.items,
          total: result.total,
          nextCursor: result.nextCursor,
          error: null,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setQueryState({
          key: queryKey,
          items: [],
          total: 0,
          nextCursor: null,
          error: reason instanceof Error ? reason.message : "历史房源查询失败",
        });
      });
    return () => controller.abort();
  }, [
    budgetOnly,
    location.city,
    location.name,
    location.wgs84Point.latitude,
    location.wgs84Point.longitude,
    queryKey,
    reloadKey,
    roomType,
    sort,
  ]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await requestHistoricalHouses({
        city: location.city,
        longitude: location.wgs84Point.longitude,
        latitude: location.wgs84Point.latitude,
        locationLabel: location.name,
        budgetOnly,
        roomType,
        sort,
        cursor: nextCursor,
      });
      setQueryState((current) =>
        current.key === queryKey
          ? {
              key: queryKey,
              items: [...current.items, ...result.items],
              total: result.total,
              nextCursor: result.nextCursor,
              error: null,
            }
          : current,
      );
    } catch (reason) {
      setQueryState((current) =>
        current.key === queryKey
          ? {
              ...current,
              error:
                reason instanceof Error ? reason.message : "加载更多房源失败",
            }
          : current,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setNotice("收藏仅保存在当前页面，刷新后会重置。");
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>
        以下为 2024-11 历史房源记录，不代表当前房态、租金或可签约状态。
      </DemoNotice>

      <SelectedLocationBar />

      <section aria-label="房源筛选" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSheet("filters")}
          className="glass-control ui-interactive flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium text-text outline-none"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          筛选房源{activeFilterCount ? `（${activeFilterCount}）` : ""}
        </button>
        <button
          type="button"
          onClick={() => setSheet("sort")}
          className="glass-control ui-interactive flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium text-text outline-none"
        >
          <ArrowUpDown aria-hidden="true" className="size-4" />
          排序：{sortLabels[sort]}
        </button>
      </section>

      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-sm text-text-muted">
          找到 {total.toLocaleString("zh-CN")} 条历史记录
        </p>
        <span className="text-xs text-text-subtle">{sortLabels[sort]}</span>
      </div>

      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
        duration={0}
        tone="neutral"
      />

      {loading ? <LoadingState message="正在查询历史房源" /> : null}
      {!loading && error ? (
        <ErrorState
          title="历史房源暂时不可用"
          message={error}
          onRetry={
            location.city === "杭州"
              ? () => setReloadKey((value) => value + 1)
              : undefined
          }
        />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="没有符合条件的历史记录"
          message="请减少筛选条件后再试。"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => {
            const house = cardData(item);
            const favorite = favoriteIds.has(item.id);
            return (
              <HouseCard
                key={item.id}
                house={house}
                distanceM={item.distanceM}
                eager={index === 0}
                actions={
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      aria-label={favorite ? "取消收藏房源" : "收藏房源"}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      <Heart
                        aria-hidden="true"
                        className="size-4"
                        fill={favorite ? "currentColor" : "none"}
                      />
                      {favorite ? "已收藏" : "收藏"}
                    </Button>
                    <Link
                      href={`/xiaozhi/chat?prompt=${encodeURIComponent(`帮我分析房源：${house.name}`)}&source=house&id=${item.id}`}
                      className="ui-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-brand bg-brand px-3 text-sm font-semibold text-white outline-none"
                    >
                      <Bot aria-hidden="true" className="size-4" />
                      问小智
                    </Link>
                  </div>
                }
              />
            );
          })}
          {nextCursor ? (
            <Button
              className="w-full"
              variant="secondary"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore
                ? "正在加载更多"
                : `加载更多（已显示 ${items.length.toLocaleString("zh-CN")} / ${total.toLocaleString("zh-CN")}）`}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ActionSheet
        open={sheet === "filters"}
        onOpenChange={(open) => setSheet(open ? "filters" : null)}
        title="筛选房源"
        description="筛选完整历史数据集，不代表当前可租"
      >
        <div className="space-y-5">
          <FilterGroup label="户型">
            {roomTypes.map((value) => (
              <button
                key={value}
                type="button"
                className={chipClass(roomType === value)}
                onClick={() => setRoomType(value)}
              >
                {value}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup label="条件">
            <button
              type="button"
              aria-pressed={budgetOnly}
              className={chipClass(budgetOnly)}
              onClick={() => setBudgetOnly((value) => !value)}
            >
              3500 元以内
            </button>
          </FilterGroup>
          <Button className="w-full" onClick={() => setSheet(null)}>
            完成筛选
          </Button>
        </div>
      </ActionSheet>

      <ActionSheet
        open={sheet === "sort"}
        onOpenChange={(open) => setSheet(open ? "sort" : null)}
        title="房源排序"
      >
        <div className="glass-panel divide-y divide-border overflow-hidden rounded-card">
          {(Object.entries(sortLabels) as [HistoricalHouseSort, string][]).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSort(value);
                  setSheet(null);
                }}
                className="ui-interactive flex min-h-12 w-full items-center justify-between border border-transparent bg-transparent px-4 text-sm text-text outline-none hover:bg-brand-soft/60"
              >
                {label}
                {sort === value ? (
                  <Check aria-hidden="true" className="size-4 text-brand" />
                ) : null}
              </button>
            ),
          )}
        </div>
      </ActionSheet>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-text">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
