import {
  Building2,
  ExternalLink,
  Map,
  MapPin,
  Navigation,
  Ruler,
} from "lucide-react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { DetailDemoActions } from "@/components/business/detail-demo-actions";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { House } from "@/features/business/domain";
import type { HistoricalHousingDetail as HistoricalHousingDetailData } from "@/features/housing/types";
import {
  buildAmapWalkingNavigationUrl,
  type AmapCoordinateSystem,
} from "@/features/maps/amap-uri";

export interface HouseDetailProps {
  house: House;
}

interface HouseDetailView {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  priceMonthly: number;
  roomType: string | null;
  areaSqm: number | null;
  description: string;
  imageSrc: string;
  tags: readonly string[];
  location: { longitude: number; latitude: number };
  isDemo: boolean;
  coordinateSystem: AmapCoordinateSystem;
  sourceUrl?: string | null;
}

function HouseDetailContent({ house }: { house: HouseDetailView }) {
  const navigationHref = buildAmapWalkingNavigationUrl({
    destination: house.location,
    destinationName: house.name,
    coordinateSystem: house.coordinateSystem,
  });
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
            {house.district ?? "区域暂无记录"} ·{" "}
            {house.address ?? "地址暂无记录"}
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
              <span>{house.roomType ?? "户型暂无记录"}</span>
            </p>
            <p className="flex items-center gap-2 text-text-muted">
              <Ruler aria-hidden="true" className="size-4 text-brand" />
              <span>
                {house.areaSqm === null ? "面积暂无记录" : `${house.areaSqm}㎡`}
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
            周边与导航
          </h2>
          <div className="mt-3 flex min-h-32 items-center justify-center rounded-control bg-surface-tint text-center text-sm text-text-muted">
            <div>
              <Map
                aria-hidden="true"
                className="mx-auto mb-2 size-6 text-brand"
              />
              <p>详情页不内嵌实时地图</p>
              <p className="mt-1 text-xs">路线以高德地图打开后的结果为准</p>
            </div>
          </div>
          <a
            href={navigationHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`在高德地图导航到${house.name}`}
            className="ui-interactive mt-3 flex min-h-12 items-center justify-center gap-2 rounded-control border border-brand bg-brand px-4 text-sm font-semibold text-white outline-none"
          >
            <Navigation aria-hidden="true" className="size-4" />
            高德步行导航
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
          {house.sourceUrl ? (
            <a
              href={house.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="ui-interactive mt-2 flex min-h-11 items-center justify-center rounded-control border border-transparent px-3 text-xs font-medium text-brand outline-none hover:bg-brand-soft"
            >
              查看历史来源
            </a>
          ) : null}
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

export function HouseDetail({ house }: HouseDetailProps) {
  return <HouseDetailContent house={{ ...house, coordinateSystem: "gcj02" }} />;
}

export function HistoricalHouseDetail({
  house,
}: {
  house: HistoricalHousingDetailData;
}) {
  const name = house.title ?? house.community ?? "房源标题暂无记录";
  return (
    <HouseDetailContent
      house={{
        id: house.id,
        name,
        district: house.district,
        address: house.address,
        priceMonthly: house.monthlyRent,
        roomType: house.layout ?? house.rentType,
        areaSqm: house.areaSqm,
        description: `${house.sourceLabel}中的历史记录。${house.disclaimer}。`,
        imageSrc: "/images/home/housing-history-2024.webp",
        tags: [house.rentType, house.orientation, house.floor].filter(
          (value): value is string => Boolean(value),
        ),
        location: house.location,
        isDemo: false,
        coordinateSystem: "wgs84",
        sourceUrl: house.sourceUrl,
      }}
    />
  );
}
