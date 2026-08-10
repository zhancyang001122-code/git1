"use client";

import {
  MapPin,
  PackageCheck,
  PackageX,
  PawPrint,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import type { ResultCard } from "@/features/agent/chat-events";

const houseSchema = z.object({
  id: z.string(),
  name: z.string(),
  district: z.string(),
  address: z.string(),
  priceMonthly: z.number().nonnegative(),
  roomType: z.string(),
  areaSqm: z.number().positive(),
  petsAllowed: z.boolean(),
  isDemo: z.boolean(),
});

const dealSchema = z.object({
  id: z.string(),
  title: z.string(),
  merchantName: z.string(),
  category: z.string(),
  salePrice: z.number().nonnegative(),
  refundable: z.boolean(),
  refundPolicyLabel: z.string(),
  isDemo: z.boolean(),
});

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  price: z.number().nonnegative(),
  inStock: z.boolean(),
  availableStock: z.number().int().nonnegative().optional(),
  isDemo: z.boolean(),
});

function HouseResult({ data }: { data: z.infer<typeof houseSchema> }) {
  return (
    <Link
      href={`/houses/${data.id}`}
      aria-label={`查看房源 ${data.name}`}
      className="block rounded-card border border-border bg-surface p-4 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Tag>{data.roomType}</Tag>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-text">
            {data.name}
          </h3>
        </div>
        <strong className="shrink-0 text-base text-danger">
          ¥{data.priceMonthly}/月
        </strong>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {data.areaSqm}㎡ · {data.district}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs text-text-subtle">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{data.address}</span>
      </p>
      {data.petsAllowed ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-success">
          <PawPrint aria-hidden="true" className="size-3.5" />
          允许宠物记录
        </p>
      ) : null}
      <SourceBadge
        source={data.isDemo ? "supabase_mock" : "housing_history_2024"}
        className="mt-3"
      />
    </Link>
  );
}

function DealResult({ data }: { data: z.infer<typeof dealSchema> }) {
  return (
    <Link
      href={`/deals/${data.id}`}
      aria-label={`查看团购 ${data.title}`}
      className="block rounded-card border border-border bg-surface p-4 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Tag>{data.category}</Tag>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-text">
            {data.title}
          </h3>
        </div>
        <strong className="shrink-0 text-base text-danger">
          ¥{data.salePrice}
        </strong>
      </div>
      <p className="mt-2 truncate text-xs text-text-muted">
        {data.merchantName}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs text-text-muted">
        <RotateCcw aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="line-clamp-1">{data.refundPolicyLabel}</span>
      </p>
      <SourceBadge source="supabase_mock" className="mt-3" />
    </Link>
  );
}

function ProductResult({ data }: { data: z.infer<typeof productSchema> }) {
  const exactStock = data.availableStock !== undefined;
  return (
    <Link
      href={`/market/products/${data.id}`}
      aria-label={`查看商品 ${data.name}`}
      className="block rounded-card border border-border bg-surface p-4 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-brand">{data.category}</p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-text">
            {data.name}
          </h3>
        </div>
        <strong className="shrink-0 text-base text-danger">
          ¥{data.price}
        </strong>
      </div>
      <p
        className={`mt-3 flex items-center gap-1 text-xs ${data.inStock ? "text-success" : "text-danger"}`}
      >
        {data.inStock ? (
          <PackageCheck aria-hidden="true" className="size-3.5" />
        ) : (
          <PackageX aria-hidden="true" className="size-3.5" />
        )}
        {exactStock
          ? `演示库存 ${data.availableStock}`
          : data.inStock
            ? "演示有货"
            : "演示缺货"}
      </p>
      <SourceBadge source="supabase_mock" className="mt-3" />
    </Link>
  );
}

export function AgentResultCards({ cards }: { cards: readonly ResultCard[] }) {
  const content = cards.flatMap((card, index) => {
    if (card.kind === "house") {
      const parsed = houseSchema.safeParse(card.data);
      return parsed.success
        ? [<HouseResult key={`house-${parsed.data.id}`} data={parsed.data} />]
        : [];
    }
    if (card.kind === "deal") {
      const parsed = dealSchema.safeParse(card.data);
      return parsed.success
        ? [<DealResult key={`deal-${parsed.data.id}`} data={parsed.data} />]
        : [];
    }
    if (card.kind === "product") {
      const parsed = productSchema.safeParse(card.data);
      return parsed.success
        ? [
            <ProductResult
              key={`product-${parsed.data.id}-${index}`}
              data={parsed.data}
            />,
          ]
        : [];
    }
    return [];
  });
  if (content.length === 0) return null;
  return (
    <section aria-label="查询结果" className="grid gap-3">
      {content}
    </section>
  );
}
