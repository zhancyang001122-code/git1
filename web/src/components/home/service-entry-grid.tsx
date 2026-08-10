"use client";

import {
  Building2,
  MapPinned,
  ShoppingBasket,
  TicketPercent,
} from "lucide-react";
import { useState } from "react";

import { DemoNotice } from "@/components/ui/demo-notice";
import { SectionHeader } from "@/components/ui/section-header";

const serviceEntries = [
  { label: "租房", description: "整租 · 合租", icon: Building2 },
  { label: "团购", description: "美食 · 玩乐", icon: TicketPercent },
  { label: "超市", description: "生鲜 · 日用", icon: ShoppingBasket },
  { label: "周边", description: "服务 · 出行", icon: MapPinned },
] as const;

export function ServiceEntryGrid() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section aria-labelledby="service-entry-title" className="space-y-3">
      <SectionHeader id="service-entry-title" title="常用服务" />
      <div className="grid grid-cols-4 gap-2">
        {serviceEntries.map(({ description, icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            className="flex min-h-24 min-w-0 flex-col items-center justify-center rounded-card border border-border bg-surface px-1.5 py-3 text-center shadow-card outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:translate-y-0"
            onClick={() =>
              setNotice(`${label}功能将在下一阶段开放，当前仅展示入口。`)
            }
          >
            <span className="mb-2 inline-flex size-10 items-center justify-center rounded-control bg-brand-soft text-brand">
              <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
            </span>
            <span className="text-sm font-semibold text-text">{label}</span>
            <span className="mt-0.5 whitespace-nowrap text-xs text-text-subtle">
              {description}
            </span>
          </button>
        ))}
      </div>
      {notice ? <DemoNotice>{notice}</DemoNotice> : null}
    </section>
  );
}
