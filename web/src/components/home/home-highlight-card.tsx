import { MapPin } from "lucide-react";
import Image from "next/image";

import { SourceBadge } from "@/components/ui/source-badge";
import type { HomeHighlight } from "@/features/home/home-types";

export interface HomeHighlightCardProps {
  item: HomeHighlight;
}

export function HomeHighlightCard({ item }: HomeHighlightCardProps) {
  return (
    <article className="min-w-0 overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-tint">
        <Image
          fill
          src={item.imageSrc}
          alt={item.imageAlt}
          sizes="(max-width: 430px) calc((100vw - 44px) / 2), 193px"
          className="object-cover"
        />
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-xs font-medium text-brand">
            {item.eyebrow}
          </p>
          {"priceText" in item ? (
            <p className="shrink-0 text-sm font-bold text-danger">
              {item.priceText}
            </p>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-semibold leading-6 text-text">
          {item.title}
        </h3>

        <p className="line-clamp-2 text-xs leading-5 text-text-muted">
          {item.detail}
        </p>

        {item.kind === "community" ? (
          <p className="text-xs text-text-subtle">{item.author}</p>
        ) : null}

        <p className="flex items-center gap-1 text-xs text-text-subtle">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{item.location}</span>
        </p>

        <SourceBadge source={item.source} />
      </div>
    </article>
  );
}
