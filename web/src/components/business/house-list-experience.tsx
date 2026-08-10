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
import { useMemo, useState } from "react";

import { HouseCard } from "@/components/business/house-card";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { EmptyState } from "@/components/ui/states";
import { Toast } from "@/components/ui/toast";
import type { House, HouseSort } from "@/features/business/domain";
import { cn } from "@/lib/cn";

export interface HouseListExperienceProps {
  houses: readonly House[];
  source: "housing_history_2024" | "supabase_mock";
}

const districts = ["全部", "拱墅区", "西湖区", "上城区"] as const;
const roomTypes = ["全部户型", "一居室", "两居室", "开间", "合租"] as const;

function chipClass(active: boolean) {
  return cn(
    "min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand",
    active
      ? "border-brand bg-brand text-white"
      : "border-border bg-surface text-text-muted hover:bg-brand-soft",
  );
}

export function HouseListExperience({
  houses,
  source,
}: HouseListExperienceProps) {
  const [district, setDistrict] = useState<(typeof districts)[number]>("全部");
  const [roomType, setRoomType] =
    useState<(typeof roomTypes)[number]>("全部户型");
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [petsOnly, setPetsOnly] = useState(false);
  const [nearSubwayOnly, setNearSubwayOnly] = useState(false);
  const [sort, setSort] = useState<HouseSort>("recommended");
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);

  const sortLabels: Record<HouseSort, string> = {
    recommended: "推荐顺序",
    price_asc: "租金从低到高",
    price_desc: "租金从高到低",
  };
  const activeFilterCount = [
    district !== "全部",
    roomType !== "全部户型",
    budgetOnly,
    petsOnly,
    nearSubwayOnly,
  ].filter(Boolean).length;

  const filteredHouses = useMemo(() => {
    const filtered = houses.filter(
      (house) =>
        (district === "全部" || house.district === district) &&
        (roomType === "全部户型" || house.roomType === roomType) &&
        (!budgetOnly || house.priceMonthly <= 3500) &&
        (!petsOnly || house.petsAllowed) &&
        (!nearSubwayOnly || house.subwayDistanceM <= 600),
    );

    if (sort === "price_asc") {
      return filtered.toSorted(
        (left, right) => left.priceMonthly - right.priceMonthly,
      );
    }
    if (sort === "price_desc") {
      return filtered.toSorted(
        (left, right) => right.priceMonthly - left.priceMonthly,
      );
    }
    return filtered;
  }, [budgetOnly, district, houses, nearSubwayOnly, petsOnly, roomType, sort]);

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
        {source === "housing_history_2024"
          ? "以下为 2024 年历史房源记录，不代表当前房态、租金或可签约状态。"
          : "以下为演示房源记录，不代表真实房源、当前房态或可签约状态。"}
      </DemoNotice>

      <section aria-label="房源筛选" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSheet("filters")}
          className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          筛选房源{activeFilterCount ? `（${activeFilterCount}）` : ""}
        </button>
        <button
          type="button"
          onClick={() => setSheet("sort")}
          className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowUpDown aria-hidden="true" className="size-4" />
          排序：{sortLabels[sort]}
        </button>
      </section>

      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-sm text-text-muted">
          找到 {filteredHouses.length} 条
          {source === "housing_history_2024" ? "历史" : "演示"}记录
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

      {filteredHouses.length > 0 ? (
        <div className="space-y-3">
          {filteredHouses.map((house, index) => {
            const favorite = favoriteIds.has(house.id);
            return (
              <HouseCard
                key={house.id}
                house={house}
                eager={index === 0}
                actions={
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      aria-label={favorite ? "取消收藏房源" : "收藏房源"}
                      onClick={() => toggleFavorite(house.id)}
                    >
                      <Heart
                        aria-hidden="true"
                        className="size-4"
                        fill={favorite ? "currentColor" : "none"}
                      />
                      {favorite ? "已收藏" : "收藏"}
                    </Button>
                    <Link
                      href={`/xiaozhi/chat?prompt=${encodeURIComponent(`帮我分析房源：${house.name}`)}&source=house&id=${house.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      <Bot aria-hidden="true" className="size-4" />
                      问小智
                    </Link>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={`没有符合条件的${source === "housing_history_2024" ? "历史" : "演示"}记录`}
          message="请减少筛选条件后再试。"
        />
      )}

      <ActionSheet
        open={sheet === "filters"}
        onOpenChange={(open) => setSheet(open ? "filters" : null)}
        title="筛选房源"
        description="筛选的是历史记录，不代表当前可租"
      >
        <div className="space-y-5">
          <FilterGroup label="区域">
            {districts.map((value) => (
              <button
                key={value}
                type="button"
                className={chipClass(district === value)}
                onClick={() => setDistrict(value)}
              >
                {value}
              </button>
            ))}
          </FilterGroup>
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
            <button
              type="button"
              aria-pressed={petsOnly}
              className={chipClass(petsOnly)}
              onClick={() => setPetsOnly((value) => !value)}
            >
              允许宠物
            </button>
            <button
              type="button"
              aria-pressed={nearSubwayOnly}
              className={chipClass(nearSubwayOnly)}
              onClick={() => setNearSubwayOnly((value) => !value)}
            >
              地铁 600m 内
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
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border">
          {(Object.entries(sortLabels) as [HouseSort, string][]).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSort(value);
                  setSheet(null);
                }}
                className="flex min-h-12 w-full items-center justify-between bg-surface px-4 text-sm text-text outline-none hover:bg-page focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
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
