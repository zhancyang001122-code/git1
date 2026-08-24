"use client";

import { BookOpenCheck, Database, MapPinned, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Tag } from "@/components/ui/tag";
import { useSelectedLocation } from "@/features/location/selected-location-provider";

const evidenceSources = [
  { label: "历史房源", icon: Database },
  { label: "高德周边", icon: MapPinned },
  { label: "官方依据", icon: BookOpenCheck },
] as const;

export function XiaozhiHero() {
  const { location } = useSelectedLocation();
  const prompt = `我预算3500元，想找${location.name}附近的一居室。请查询2024年历史房源，再找附近的地铁和超市，并说明签约前需要核验哪些信息、是否需要办理网签备案。`;

  return (
    <section
      aria-labelledby="xiaozhi-home-title"
      className="glass-panel relative overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft/90 to-accent/10 p-4"
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 size-32 rounded-full bg-white/45 blur-2xl"
      />
      <div className="relative grid grid-cols-[1fr_76px] items-start gap-3">
        <div className="min-w-0">
          <Tag className="mb-2 bg-white/75">作品主线 · 租房决策</Tag>
          <h2
            id="xiaozhi-home-title"
            className="text-lg font-bold leading-7 text-text"
          >
            从预算到签约核验，一次问完
          </h2>
          <p className="mt-1 text-sm leading-[22px] text-text-muted">
            让历史房源、高德地图和租赁知识各自提供可核验事实。
          </p>
        </div>

        <div className="relative aspect-square overflow-hidden rounded-feature bg-white/70 shadow-floating">
          <Image
            fill
            src="/images/home/xiaozhi-mascot.png"
            alt=""
            sizes="76px"
            loading="eager"
            className="object-contain"
          />
          <Sparkles
            aria-hidden="true"
            className="absolute right-2 top-2 z-10 size-4 text-accent"
          />
        </div>
      </div>

      <div
        className="relative mt-3 grid grid-cols-3 gap-2"
        aria-label="主演示证据来源"
      >
        {evidenceSources.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="flex min-w-0 items-center justify-center gap-1 rounded-control bg-white/70 px-2 py-2 text-xs font-medium text-text-muted"
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/xiaozhi/chat?q=${encodeURIComponent(prompt)}`}
          className="ui-interactive inline-flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-3 text-sm font-semibold text-white outline-none hover:bg-brand-strong"
        >
          开始主演示
        </Link>
        <Link
          href="/case-study"
          className="glass-control ui-interactive inline-flex min-h-11 items-center justify-center rounded-control border px-3 text-sm font-semibold text-brand outline-none hover:bg-white"
        >
          查看交付证据
        </Link>
      </div>
    </section>
  );
}
