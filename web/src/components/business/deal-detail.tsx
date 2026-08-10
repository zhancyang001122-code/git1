import {
  CalendarDays,
  MapPin,
  RotateCcw,
  ShoppingBag,
  Store,
} from "lucide-react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { DetailDemoActions } from "@/components/business/detail-demo-actions";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { Deal } from "@/features/business/domain";

export interface DealDetailProps {
  deal: Deal;
}

export function DealDetail({ deal }: DealDetailProps) {
  return (
    <div className="space-y-5 pb-6">
      <BusinessCardImage
        src={deal.imageSrc}
        alt={`${deal.title}的演示餐食图片`}
        sizes="430px"
        className="aspect-[16/10]"
      />
      <div className="space-y-5 px-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SourceBadge source="supabase_mock" />
            <Tag>{deal.category}</Tag>
          </div>
          <h2 className="text-2xl font-semibold leading-8 text-text">
            {deal.title}
          </h2>
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Store aria-hidden="true" className="size-4" />
            {deal.merchantName}
          </p>
          <div className="flex items-baseline gap-3">
            <strong className="text-2xl text-danger">¥{deal.salePrice}</strong>
            <span className="text-sm text-text-subtle line-through">
              ¥{deal.originalPrice}
            </span>
            <span className="text-xs text-text-subtle">
              演示销量 {deal.salesCount}
            </span>
          </div>
          <DemoNotice>
            当前页面不连接真实团购、库存或支付系统；价格、销量和规则仅用于前端演示。
          </DemoNotice>
        </section>

        <section
          aria-labelledby="deal-package"
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <h2 id="deal-package" className="text-base font-semibold text-text">
            套餐内容
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            {deal.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deal.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="deal-store"
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <h2 id="deal-store" className="text-base font-semibold text-text">
            门店与有效期
          </h2>
          <div className="mt-3 space-y-3 text-sm text-text-muted">
            <p className="flex items-start gap-2">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand"
              />
              {deal.address}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 text-brand" />
              有效期至 {deal.validUntil}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="deal-rules"
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <h2 id="deal-rules" className="text-base font-semibold text-text">
            退款与使用规则
          </h2>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-text-muted">
            {deal.refundable ? (
              <RotateCcw
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-success"
              />
            ) : (
              <ShoppingBag
                aria-hidden="true"
                className="mt-1 size-4 shrink-0"
              />
            )}
            {deal.refundPolicyLabel}
          </p>
          <p className="mt-3 text-xs text-text-subtle">
            规则来源：演示业务规则 · DEMO-2026-08 · 非真实商家条款
          </p>
        </section>

        <DetailDemoActions entityId={deal.id} title={deal.title} kind="deal" />
      </div>
    </div>
  );
}
