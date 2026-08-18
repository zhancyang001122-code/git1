import { RotateCcw, ShoppingBag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { Deal } from "@/features/business/domain";

export interface DealCardProps {
  deal: Deal;
  actions?: ReactNode;
  eager?: boolean;
}

export function DealCard({ actions, deal, eager }: DealCardProps) {
  return (
    <article className="glass-panel group overflow-hidden rounded-card">
      <Link
        href={`/deals/${deal.id}`}
        className="ui-interactive block border border-transparent outline-none"
      >
        <BusinessCardImage
          src={deal.imageSrc}
          alt={`${deal.title}的演示餐食图片`}
          sizes="(max-width: 430px) 50vw, 215px"
          className="aspect-[4/3]"
          eager={eager}
        />
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <Tag>{deal.category}</Tag>
            <span className="text-xs text-text-subtle">
              已售 {deal.salesCount}
            </span>
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-6 text-text">
            {deal.title}
          </h2>
          <p className="truncate text-xs text-text-muted">
            {deal.merchantName}
          </p>
          <div className="flex items-baseline gap-2">
            <strong className="text-base text-danger">¥{deal.salePrice}</strong>
            <span className="text-xs text-text-subtle line-through">
              ¥{deal.originalPrice}
            </span>
          </div>
          <p className="flex items-center gap-1 text-xs text-text-muted">
            {deal.refundable ? (
              <RotateCcw aria-hidden="true" className="size-3.5 text-success" />
            ) : (
              <ShoppingBag aria-hidden="true" className="size-3.5" />
            )}
            <span className="line-clamp-1">{deal.refundPolicyLabel}</span>
          </p>
          <SourceBadge source="supabase_mock" />
        </div>
      </Link>
      {actions ? (
        <div className="border-t border-border p-3">{actions}</div>
      ) : null}
    </article>
  );
}
