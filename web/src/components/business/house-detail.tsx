import {
  Building2,
  Map,
  MapPin,
  PawPrint,
  Ruler,
  TrainFront,
} from "lucide-react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { DetailDemoActions } from "@/components/business/detail-demo-actions";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { House } from "@/features/business/domain";

export interface HouseDetailProps {
  house: House;
}

export function HouseDetail({ house }: HouseDetailProps) {
  return (
    <div className="space-y-5 pb-6">
      <BusinessCardImage
        src={house.imageSrc}
        alt={`${house.name}的房源配图`}
        sizes="430px"
        className="aspect-[16/10]"
        eager
      />
      <div className="space-y-5 px-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SourceBadge
              source={house.isDemo ? "supabase_mock" : "housing_history_2024"}
            />
            <strong className="text-lg text-danger">
              ¥{house.priceMonthly}/月
            </strong>
          </div>
          <h2 className="text-2xl font-semibold leading-8 text-text">
            {house.name}
          </h2>
          <p className="flex items-start gap-1 text-sm text-text-muted">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {house.district} · {house.address}
          </p>
          <DemoNotice>
            {house.isDemo
              ? "这是演示房源记录，不代表真实房源或当前可租状态。"
              : "这是 2024 年历史房源数据，不代表当前仍可出租，也不能替代真实看房和合同核验。"}
          </DemoNotice>
        </section>

        <section
          aria-labelledby="house-facts"
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <h2 id="house-facts" className="text-base font-semibold text-text">
            房源记录
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <p className="flex items-center gap-2 text-text-muted">
              <Building2 aria-hidden="true" className="size-4 text-brand" />
              <span>{house.roomType}</span>
            </p>
            <p className="flex items-center gap-2 text-text-muted">
              <Ruler aria-hidden="true" className="size-4 text-brand" />
              <span>{house.areaSqm}㎡</span>
            </p>
            <p className="flex items-center gap-2 text-text-muted">
              <TrainFront aria-hidden="true" className="size-4 text-brand" />
              <span>地铁约 {house.subwayDistanceM}m</span>
            </p>
            <p className="flex items-center gap-2 text-text-muted">
              <PawPrint aria-hidden="true" className="size-4 text-brand" />
              <span>
                {house.petsAllowed ? "记录允许宠物" : "记录不允许宠物"}
              </span>
            </p>
          </div>
          <p className="mt-4 text-sm leading-6 text-text-muted">
            {house.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {house.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="house-nearby"
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <h2 id="house-nearby" className="text-base font-semibold text-text">
            周边与地图占位
          </h2>
          <div className="mt-3 flex min-h-32 items-center justify-center rounded-control bg-surface-tint text-center text-sm text-text-muted">
            <div>
              <Map
                aria-hidden="true"
                className="mx-auto mb-2 size-6 text-brand"
              />
              <p>未请求高德实时地图</p>
              <p className="mt-1 text-xs">
                仅展示历史字段：距地铁约 {house.subwayDistanceM} 米
              </p>
            </div>
          </div>
        </section>

        <DetailDemoActions
          entityId={house.id}
          title={house.name}
          kind="house"
        />
      </div>
    </div>
  );
}
