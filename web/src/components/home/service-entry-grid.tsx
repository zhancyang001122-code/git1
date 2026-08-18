"use client";

import {
  Building2,
  MapPinned,
  ShoppingBasket,
  TicketPercent,
} from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/section-header";

const serviceEntries = [
  {
    label: "租房",
    description: "整租 · 合租",
    icon: Building2,
    href: "/houses",
  },
  {
    label: "团购",
    description: "美食 · 玩乐",
    icon: TicketPercent,
    href: "/deals",
  },
  {
    label: "超市",
    description: "生鲜 · 日用",
    icon: ShoppingBasket,
    href: "/market",
  },
  {
    label: "周边",
    description: "服务 · 出行",
    icon: MapPinned,
    href: "/nearby",
  },
] as const;

export function ServiceEntryGrid() {
  return (
    <section aria-labelledby="service-entry-title" className="space-y-2.5">
      <SectionHeader id="service-entry-title" title="常用服务" />
      <div className="grid grid-cols-4 gap-2">
        {serviceEntries.map(({ description, href, icon: Icon, label }) => (
          <Link
            key={label}
            href={href}
            aria-label={label}
            className="glass-panel ui-interactive flex min-h-20 min-w-0 flex-col items-center justify-center rounded-card px-1 py-2.5 text-center outline-none motion-reduce:transition-none hover:bg-brand-soft/70"
          >
            <span className="mb-1.5 inline-flex size-9 items-center justify-center rounded-control bg-brand-soft text-brand">
              <Icon
                aria-hidden="true"
                className="size-[18px]"
                strokeWidth={2}
              />
            </span>
            <span className="text-sm font-semibold text-text">{label}</span>
            <span className="mt-0.5 hidden whitespace-nowrap text-xs text-text-subtle min-[390px]:block">
              {description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
