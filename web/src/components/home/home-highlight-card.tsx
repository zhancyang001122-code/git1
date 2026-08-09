import { Building2, MapPin, ShoppingBasket, Soup, Trees } from "lucide-react";

import { SourceBadge } from "@/components/ui/source-badge";
import type { HomeHighlight } from "@/features/home/home-types";

const kindIcons = {
  housing: Building2,
  deal: Soup,
  product: ShoppingBasket,
  community: Trees,
} satisfies Record<HomeHighlight["kind"], typeof Building2>;

export interface HomeHighlightCardProps {
  item: HomeHighlight;
}

export function HomeHighlightCard({ item }: HomeHighlightCardProps) {
  const Icon = kindIcons[item.kind];

  return (
    <article className="min-w-0 overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-soft via-surface-tint to-white text-brand">
        <span className="inline-flex size-14 items-center justify-center rounded-feature bg-white/75 shadow-sm">
          <Icon aria-hidden="true" className="size-7" strokeWidth={1.75} />
        </span>
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
