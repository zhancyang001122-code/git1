"use client";

import { Bot, Heart, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { HouseCard } from "@/components/business/house-card";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { EmptyState } from "@/components/ui/states";
import type { House, HouseSort } from "@/features/business/domain";
import { cn } from "@/lib/cn";

export interface HouseListExperienceProps {
  houses: readonly House[];
}

const districts = ["全部", "拱墅区", "西湖区", "上城区"] as const;
const roomTypes = ["全部户型", "一居室", "两居室", "开间", "合租"] as const;

function chipClass(active: boolean) {
  return cn(
    "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand",
    active
      ? "border-brand bg-brand text-white"
      : "border-border bg-surface text-text-muted hover:bg-brand-soft",
  );
}

export function HouseListExperience({ houses }: HouseListExperienceProps) {
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
        以下为 2024 年历史房源记录，不代表当前房态、租金或可签约状态。
      </DemoNotice>

      <section aria-label="房源筛选" className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
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
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
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
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            className={chipClass(budgetOnly)}
            onClick={() => setBudgetOnly((value) => !value)}
          >
            3500 元以内
          </button>
          <button
            type="button"
            className={chipClass(petsOnly)}
            onClick={() => setPetsOnly((value) => !value)}
          >
            允许宠物
          </button>
          <button
            type="button"
            className={chipClass(nearSubwayOnly)}
            onClick={() => setNearSubwayOnly((value) => !value)}
          >
            <SlidersHorizontal
              aria-hidden="true"
              className="mr-1 inline size-3.5"
            />
            更多：地铁 600m 内
          </button>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          找到 {filteredHouses.length} 条历史记录
        </p>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <span>排序</span>
          <select
            aria-label="排序方式"
            value={sort}
            onChange={(event) => setSort(event.target.value as HouseSort)}
            className="h-9 rounded-control border border-border bg-surface px-2 text-xs text-text outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="recommended">推荐顺序</option>
            <option value="price_asc">租金从低到高</option>
            <option value="price_desc">租金从高到低</option>
          </select>
        </label>
      </div>

      {notice ? <DemoNotice>{notice}</DemoNotice> : null}

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
          title="没有符合条件的历史记录"
          message="请减少筛选条件后再试。"
        />
      )}
    </div>
  );
}
