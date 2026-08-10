import { Clock3, MapPin } from "lucide-react";
import Link from "next/link";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { SourceBadge } from "@/components/ui/source-badge";
import type { Store } from "@/features/business/domain";

export interface StoreCardProps {
  store: Store;
}

export function StoreCard({ store }: StoreCardProps) {
  return (
    <article className="group overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <Link
        href={`/market/stores/${store.id}`}
        className="grid min-h-32 grid-cols-[104px_1fr] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <BusinessCardImage
          src={store.imageSrc}
          alt={`${store.name}的演示门店图片`}
          sizes="104px"
          className="h-full min-h-32"
        />
        <div className="min-w-0 space-y-2 p-3">
          <h2 className="text-base font-semibold leading-6 text-text">
            {store.name}
          </h2>
          <p className="flex items-center gap-1 text-xs text-text-muted">
            <MapPin aria-hidden="true" className="size-3.5" />
            {store.district} · {store.address}
          </p>
          <p className="flex items-center gap-1 text-xs text-text-muted">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {store.deliveryMinutes
              ? `演示预计 ${store.deliveryMinutes} 分钟送达`
              : "到店服务演示"}
          </p>
          <SourceBadge source="supabase_mock" />
        </div>
      </Link>
    </article>
  );
}
