import { Building2, MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { SourceBadge, type SourceCode } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import { formatStraightLineDistance } from "@/features/maps/straight-line-distance";

export interface HouseCardData {
  id: string;
  name: string;
  priceMonthly: number;
  priceMonthlyMax?: number | null;
  roomType: string | null;
  areaSqm: number | null;
  district: string | null;
  address: string | null;
  imageSrc: string | null;
  isDemo: boolean;
  source?: SourceCode;
  recordLabel?: string;
}

export interface HouseCardProps {
  house: HouseCardData;
  actions?: ReactNode;
  distanceM?: number;
  eager?: boolean;
}

export function HouseCard({
  actions,
  distanceM,
  eager,
  house,
}: HouseCardProps) {
  return (
    <article className="glass-panel group overflow-hidden rounded-card">
      <Link
        href={`/houses/${house.id}`}
        className="ui-interactive grid min-h-40 grid-cols-[116px_1fr] border border-transparent outline-none"
      >
        {house.imageSrc ? (
          <BusinessCardImage
            src={house.imageSrc}
            alt={`${house.name}的房源配图`}
            sizes="116px"
            className="h-full min-h-40"
            eager={eager}
          />
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 bg-surface-tint px-2 text-center text-xs text-text-subtle">
            <Building2 aria-hidden="true" className="size-7 text-brand" />
            <span>未缓存原帖图片</span>
          </div>
        )}
        <div className="min-w-0 space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <Tag>
              {house.recordLabel ??
                (house.isDemo ? "2024 演示记录" : "2024 历史记录")}
            </Tag>
            <span className="shrink-0 text-sm font-bold text-danger">
              ¥{house.priceMonthly}
              {house.priceMonthlyMax &&
              house.priceMonthlyMax !== house.priceMonthly
                ? `–${house.priceMonthlyMax}`
                : ""}
              /月
            </span>
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-6 text-text">
            {house.name}
          </h2>
          <p className="text-xs leading-5 text-text-muted">
            {house.roomType ?? "户型暂无记录"} ·{" "}
            {house.areaSqm === null ? "面积暂无记录" : `${house.areaSqm}㎡`}
          </p>
          <p className="flex items-center gap-1 text-xs text-text-subtle">
            <MapPin aria-hidden="true" className="size-3.5" />
            <span className="truncate">
              {house.district ?? "区域暂无记录"} ·{" "}
              {house.address ?? "地址暂无记录"}
            </span>
          </p>
          {distanceM !== undefined ? (
            <p className="flex items-center gap-1 text-xs font-medium text-brand">
              <Navigation aria-hidden="true" className="size-3.5" />
              距您直线 {formatStraightLineDistance(distanceM)}
            </p>
          ) : null}
          <SourceBadge
            source={
              house.source ??
              (house.isDemo ? "supabase_mock" : "housing_history_2024")
            }
          />
        </div>
      </Link>
      {actions ? (
        <div className="border-t border-border p-3">{actions}</div>
      ) : null}
    </article>
  );
}
