"use client";

import { Bot, Heart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DealCard } from "@/components/business/deal-card";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SearchBar } from "@/components/ui/search-bar";
import { EmptyState } from "@/components/ui/states";
import type { Deal } from "@/features/business/domain";
import { cn } from "@/lib/cn";

export interface DealListExperienceProps {
  deals: readonly Deal[];
}

export function DealListExperience({ deals }: DealListExperienceProps) {
  const categories = ["全部", ...new Set(deals.map((deal) => deal.category))];
  const [category, setCategory] = useState("全部");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [notice, setNotice] = useState<string | null>(null);

  const filteredDeals = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return deals.filter(
      (deal) =>
        (category === "全部" || deal.category === category) &&
        (!refundableOnly || deal.refundable) &&
        (!normalized ||
          `${deal.title}${deal.merchantName}${deal.tags.join("")}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized)),
    );
  }, [category, deals, query, refundableOnly]);

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
        团购、销量和价格均为演示业务数据，当前不连接真实交易平台。
      </DemoNotice>
      <SearchBar
        label="搜索演示团购"
        value={queryInput}
        onValueChange={setQueryInput}
        onSubmit={setQuery}
        placeholder="搜索团购或商家"
      />

      <section aria-label="团购筛选" className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand",
                category === value
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface text-text-muted",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={refundableOnly}
          onClick={() => setRefundableOnly((value) => !value)}
          className={cn(
            "min-h-9 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand",
            refundableOnly
              ? "border-brand bg-brand text-white"
              : "border-border bg-surface text-text-muted",
          )}
        >
          仅看可退款
        </button>
      </section>

      <p className="text-sm text-text-muted">
        共 {filteredDeals.length} 个演示团购
      </p>
      {notice ? <DemoNotice>{notice}</DemoNotice> : null}

      {filteredDeals.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filteredDeals.map((deal, index) => {
            const favorite = favoriteIds.has(deal.id);
            return (
              <DealCard
                key={deal.id}
                deal={deal}
                eager={index === 0}
                actions={
                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      aria-label={favorite ? "取消收藏团购" : "收藏团购"}
                      onClick={() => toggleFavorite(deal.id)}
                      className="w-full px-2"
                    >
                      <Heart
                        aria-hidden="true"
                        className="size-4"
                        fill={favorite ? "currentColor" : "none"}
                      />
                      {favorite ? "已收藏" : "收藏"}
                    </Button>
                    <Link
                      href={`/xiaozhi/chat?prompt=${encodeURIComponent(`这个团购适合我吗：${deal.title}`)}&source=deal&id=${deal.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-control bg-brand px-2 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
          title="没有符合条件的演示团购"
          message="请调整分类或搜索词。"
        />
      )}
    </div>
  );
}
