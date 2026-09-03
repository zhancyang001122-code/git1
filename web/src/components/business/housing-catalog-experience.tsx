"use client";

import { useState } from "react";

import { HistoricalHouseListExperience } from "@/components/business/historical-house-list-experience";
import { SocialHouseListExperience } from "@/components/business/social-house-list-experience";
import { cn } from "@/lib/cn";

type HousingSource = "history" | "social";

export function HousingCatalogExperience() {
  const [source, setSource] = useState<HousingSource>("history");

  return (
    <>
      <div
        className="mx-4 mt-4 grid grid-cols-2 rounded-control border border-border bg-surface p-1 shadow-card"
        role="tablist"
        aria-label="房源数据来源"
      >
        <button
          type="button"
          role="tab"
          aria-selected={source === "history"}
          onClick={() => setSource("history")}
          className={cn(
            "ui-interactive min-h-10 rounded-control px-3 text-sm font-medium outline-none",
            source === "history" ? "bg-brand text-white" : "text-text-muted",
          )}
        >
          2024 历史房源
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === "social"}
          onClick={() => setSource("social")}
          className={cn(
            "ui-interactive min-h-10 rounded-control px-3 text-sm font-medium outline-none",
            source === "social" ? "bg-brand text-white" : "text-text-muted",
          )}
        >
          近期租房线索
        </button>
      </div>
      <div className="pt-4">
        {source === "history" ? <HistoricalHouseListExperience /> : null}
        {source === "social" ? <SocialHouseListExperience /> : null}
      </div>
    </>
  );
}
