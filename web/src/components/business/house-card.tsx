import { MapPin, PawPrint } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { House } from "@/features/business/domain";

export interface HouseCardProps {
  house: House;
  actions?: ReactNode;
}

export function HouseCard({ actions, house }: HouseCardProps) {
  return (
    <article className="group overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <Link
        href={`/houses/${house.id}`}
        className="grid min-h-40 grid-cols-[116px_1fr] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <BusinessCardImage
          src={house.imageSrc}
          alt={`${house.name}的室内演示图`}
          sizes="116px"
          className="h-full min-h-40"
        />
        <div className="min-w-0 space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <Tag>2024 历史示例</Tag>
            <span className="shrink-0 text-sm font-bold text-danger">
              ¥{house.priceMonthly}/月
            </span>
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-6 text-text">
            {house.name}
          </h2>
          <p className="text-xs leading-5 text-text-muted">
            {house.roomType} · {house.areaSqm}㎡ · 地铁约{" "}
            {house.subwayDistanceM}m
          </p>
          <p className="flex items-center gap-1 text-xs text-text-subtle">
            <MapPin aria-hidden="true" className="size-3.5" />
            <span className="truncate">
              {house.district} · {house.address}
            </span>
          </p>
          {house.petsAllowed ? (
            <p className="flex items-center gap-1 text-xs font-medium text-success">
              <PawPrint aria-hidden="true" className="size-3.5" />
              允许宠物记录
            </p>
          ) : null}
          <SourceBadge source="housing_history_2024" />
        </div>
      </Link>
      {actions ? (
        <div className="border-t border-border p-3">{actions}</div>
      ) : null}
    </article>
  );
}
