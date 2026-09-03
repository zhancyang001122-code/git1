"use client";

import {
  ArrowUpDown,
  Check,
  ExternalLink,
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
import { Tag } from "@/components/ui/tag";
import { useSelectedLocation } from "@/features/location/selected-location-provider";
import {
  socialHousingListResponseSchema,
  type SocialHousingListResponse,
} from "@/features/social-housing/list-contract";
import type {
  SocialHousingLeadItem,
  SocialHousingPlatform,
} from "@/features/social-housing/types";
import { cn } from "@/lib/cn";

const roomTypes = ["全部户型", "一居室", "两居室", "开间", "合租"] as const;
type RoomType = (typeof roomTypes)[number];
type SocialHouseSort =
  "distance_asc" | "published_desc" | "price_asc" | "price_desc";

const sortLabels: Record<SocialHouseSort, string> = {
  distance_asc: "距离最近",
  published_desc: "发布时间最新",
  price_asc: "租金从低到高",
  price_desc: "租金从高到低",
};

const platformLabels: Record<SocialHousingPlatform, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
};

function chipClass(active: boolean) {
  return cn(
    "ui-interactive min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium outline-none",
    active
      ? "border-brand bg-brand text-white"
      : "glass-control text-text-muted hover:bg-brand-soft",
  );
}

function cardData(item: SocialHousingLeadItem): HouseCardData {
  return {
    id: item.id,
    name: item.title,
    priceMonthly: item.monthlyRentMin,
    priceMonthlyMax: item.monthlyRentMax,
    roomType: item.layout ?? item.rentType,
    areaSqm: item.areaSqm,
    district: item.district,
    address: item.address ?? item.community,
    imageSrc: null,
    isDemo: false,
    source: "social_housing_leads",
    recordLabel: item.verificationLabel,
  };
}

function sourceSummary(item: SocialHousingLeadItem): string {
  const platforms = item.sourcePlatforms
    .map((platform) => platformLabels[platform])
    .join(" + ");
  return `${platforms} · ${item.sourceCount} 个来源`;
}

async function requestSocialHousingLeads(options: {
  city: string;
  longitude: number;
  latitude: number;
  locationLabel: string;
  budgetOnly: boolean;
  roomType: RoomType;
  sort: SocialHouseSort;
  cursor?: string;
  signal?: AbortSignal;
}): Promise<SocialHousingListResponse> {
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

  const response = await fetch(`/api/housing-leads?${parameters}`, {
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
        : "近期租房线索查询失败，请稍后重试";
    throw new Error(message);
  }
  const parsed = socialHousingListResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("近期租房线索返回格式无效，请稍后重试");
  return parsed.data;
}

export function SocialHouseListExperience() {
  const { location } = useSelectedLocation();
  const [roomType, setRoomType] = useState<RoomType>("全部户型");
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [sort, setSort] = useState<SocialHouseSort>("distance_asc");
  const [queryState, setQueryState] = useState<{
    key: string;
    items: readonly SocialHousingLeadItem[];
    total: number;
    nextCursor: string | null;
    error: string | null;
  }>({ key: "", items: [], total: 0, nextCursor: null, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);

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
      : "近期社交平台租房线索目前只覆盖杭州，请先把定位切换到杭州。";
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
    void requestSocialHousingLeads({
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
          error:
            reason instanceof Error ? reason.message : "近期租房线索查询失败",
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
      const result = await requestSocialHousingLeads({
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
                reason instanceof Error ? reason.message : "加载更多线索失败",
            }
          : current,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const activeFilterCount = [roomType !== "全部户型", budgetOnly].filter(
    Boolean,
  ).length;

  return (
    <div className="space-y-4 px-4 pb-4">
      <DemoNotice>
        线索来自公开帖子并经过脱敏和字段清洗；房态、发布者身份、租金与地址均未经本项目核验。
      </DemoNotice>

      <SelectedLocationBar />

      <section aria-label="租房线索筛选" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSheet("filters")}
          className="glass-control ui-interactive flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium text-text outline-none"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          筛选线索{activeFilterCount ? `（${activeFilterCount}）` : ""}
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
          找到 {total.toLocaleString("zh-CN")} 条近期线索
        </p>
        <span className="text-xs text-text-subtle">只展示已通过展示审核</span>
      </div>

      {loading ? <LoadingState message="正在查询近期租房线索" /> : null}
      {!loading && error ? (
        <ErrorState
          title="近期租房线索暂时不可用"
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
          title="暂无通过展示审核的近期线索"
          message="新采集内容需要完成字段清洗、去重和展示审核后才会出现。"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <HouseCard
              key={item.id}
              house={cardData(item)}
              distanceM={item.distanceM}
              actions={
                <div>
                  <Link
                    href={`/houses/${item.id}`}
                    className="glass-control ui-interactive flex min-h-11 w-full items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium text-text outline-none"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    查看来源
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <Tag>{sourceSummary(item)}</Tag>
                    <span>
                      发布于
                      {new Intl.DateTimeFormat("zh-CN", {
                        timeZone: "Asia/Shanghai",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date(item.publishedAt))}
                    </span>
                  </div>
                </div>
              }
            />
          ))}
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
        title="筛选租房线索"
        description="筛选已通过展示审核的结构化线索，不代表当前可租"
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
        title="线索排序"
      >
        <div className="glass-panel divide-y divide-border overflow-hidden rounded-card">
          {(Object.entries(sortLabels) as [SocialHouseSort, string][]).map(
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
