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
import { SourceBadge, type SourceCode } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { House } from "@/features/business/domain";
import type { HistoricalHousingDetail as HistoricalHousingDetailData } from "@/features/housing/types";
import {
  buildAmapWalkingNavigationUrl,
  type AmapCoordinateSystem,
} from "@/features/maps/amap-uri";
import type {
  SocialHousingLeadDetail as SocialHousingLeadDetailData,
  SocialHousingLeadSource,
} from "@/features/social-housing/types";

export interface HouseDetailProps {
  house: House;
}

interface HouseDetailView {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  priceMonthly: number;
  priceMonthlyMax?: number | null;
  roomType: string | null;
  areaSqm: number | null;
  description: string;
  imageSrc: string | null;
  tags: readonly string[];
  location: { longitude: number; latitude: number };
  source: SourceCode;
  notice: string;
  coordinateSystem: AmapCoordinateSystem;
  showDemoActions: boolean;
  sourceUrl?: string | null;
  socialSources?: readonly SocialHousingLeadSource[];
}

const platformLabels = {
  xiaohongshu: "小红书",
  douyin: "抖音",
} as const;

const sourceStatusLabels = {
  not_obviously_closed: "原帖未显示已结束",
  closed: "原帖显示已结束",
  unknown: "状态未知",
} as const;

function formatSourceDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function HouseDetailContent({ house }: { house: HouseDetailView }) {
  const navigationHref = buildAmapWalkingNavigationUrl({
    destination: house.location,
    destinationName: house.name,
    coordinateSystem: house.coordinateSystem,
  });
  return (
    <div className="space-y-5 pb-6">
      {house.imageSrc ? (
        <BusinessCardImage
          src={house.imageSrc}
          alt={`${house.name}的房源配图`}
          sizes="430px"
          className="aspect-[16/10]"
          eager
        />
      ) : (
        <div
          role="img"
          aria-label={`${house.name}暂无授权配图`}
          className="flex aspect-[16/10] items-center justify-center bg-surface-tint text-center text-sm text-text-muted"
        >
          <div>
            <Building2
              aria-hidden="true"
              className="mx-auto mb-2 size-7 text-brand"
            />
            <p>未缓存原帖图片</p>
          </div>
        </div>
      )}
      <div className="space-y-5 px-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SourceBadge source={house.source} />
            <strong className="text-lg text-danger">
              ¥{house.priceMonthly}
              {house.priceMonthlyMax &&
              house.priceMonthlyMax !== house.priceMonthly
                ? `–${house.priceMonthlyMax}`
                : ""}
              /月
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
          <DemoNotice>{house.notice}</DemoNotice>
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

        {house.socialSources ? (
          <section
            aria-labelledby="house-sources"
            className="rounded-card border border-border bg-surface p-4 shadow-card"
          >
            <h2
              id="house-sources"
              className="text-base font-semibold text-text"
            >
              来源与核验
            </h2>
            <p className="mt-2 text-xs leading-5 text-text-muted">
              这里只保留去除追踪参数后的原帖地址；请在联系发布者前再次核验房态、身份与价格。
            </p>
            <div className="mt-3 space-y-2">
              {house.socialSources.map((source) => {
                const platformLabel = platformLabels[source.platform];
                return (
                  <a
                    key={`${source.platform}:${source.canonicalUrl}`}
                    href={source.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`查看${platformLabel}原帖`}
                    className="ui-interactive flex min-h-12 items-center justify-between gap-3 rounded-control border border-border px-3 text-sm outline-none hover:border-brand hover:bg-brand-soft"
                  >
                    <span className="min-w-0">
                      <strong className="block font-semibold text-text">
                        {platformLabel}原帖
                      </strong>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        发布于 {formatSourceDate(source.sourcePublishedAt)} ·{" "}
                        {sourceStatusLabels[source.sourceStatus]}
                      </span>
                    </span>
                    <ExternalLink
                      aria-hidden="true"
                      className="size-4 shrink-0 text-brand"
                    />
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {house.showDemoActions ? (
          <DetailDemoActions
            entityId={house.id}
            title={house.name}
            kind="house"
          />
        ) : null}
      </div>
    </div>
  );
}

export function HouseDetail({ house }: HouseDetailProps) {
  return (
    <HouseDetailContent
      house={{
        ...house,
        coordinateSystem: "gcj02",
        source: house.isDemo ? "supabase_mock" : "housing_history_2024",
        notice: house.isDemo
          ? "这是演示房源记录，不代表真实房源或当前可租状态。"
          : "这是 2024 年历史房源数据，不代表当前仍可出租，也不能替代真实看房和合同核验。",
        showDemoActions: true,
      }}
    />
  );
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
        source: "housing_history_2024",
        notice:
          "这是 2024 年历史房源数据，不代表当前仍可出租，也不能替代真实看房和合同核验。",
        coordinateSystem: "wgs84",
        showDemoActions: true,
        sourceUrl: house.sourceUrl,
      }}
    />
  );
}

export function SocialHousingLeadDetail({
  lead,
}: {
  lead: SocialHousingLeadDetailData;
}) {
  return (
    <HouseDetailContent
      house={{
        id: lead.id,
        name: lead.title,
        district: lead.district,
        address: lead.address ?? lead.community,
        priceMonthly: lead.monthlyRentMin,
        priceMonthlyMax: lead.monthlyRentMax,
        roomType: lead.layout ?? lead.rentType,
        areaSqm: lead.areaSqm,
        description: lead.summary,
        imageSrc: null,
        tags: [
          lead.verificationLabel,
          lead.rentType,
          ...lead.sourcePlatforms.map((platform) => platformLabels[platform]),
        ].filter((value): value is string => Boolean(value)),
        location: lead.location,
        source: "social_housing_leads",
        notice: `${lead.disclaimer}，不代表当前可租。`,
        coordinateSystem: lead.coordinateSystem,
        showDemoActions: false,
        socialSources: lead.sources,
      }}
    />
  );
}
