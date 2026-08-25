"use client";

import {
  MapPin,
  Navigation,
  PackageCheck,
  PackageX,
  RotateCcw,
  Save,
  ShieldQuestion,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import { Toast } from "@/components/ui/toast";
import {
  preferenceProposalDataSchema,
  type PreferenceProposalData,
  type ResultCard,
} from "@/features/agent/chat-events";
import { safeNextPath } from "@/features/auth/safe-next";
import { buildAmapWalkingNavigationUrl } from "@/features/maps/amap-uri";

const houseSchema = z.object({
  id: z.string(),
  name: z.string(),
  district: z.string().nullable(),
  address: z.string().nullable(),
  priceMonthly: z.number().nonnegative(),
  roomType: z.string().nullable(),
  areaSqm: z.number().positive().nullable(),
  distanceM: z.number().nonnegative().optional(),
  isDemo: z.boolean(),
  detailAvailable: z.boolean().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  location: z
    .object({ longitude: z.number(), latitude: z.number() })
    .optional(),
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

const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  category: z.string(),
  distanceM: z.number().nonnegative(),
  source: z.literal("amap"),
  isDemo: z.boolean(),
  location: z.object({ longitude: z.number(), latitude: z.number() }),
});

function HouseResult({ data }: { data: z.infer<typeof houseSchema> }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Tag>{data.roomType ?? "户型暂无记录"}</Tag>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-text">
            {data.name}
          </h3>
        </div>
        <strong className="shrink-0 text-base text-danger">
          ¥{data.priceMonthly}/月
        </strong>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {data.areaSqm === null ? "面积暂无记录" : `${data.areaSqm}㎡`} ·{` `}
        {data.district ?? "区域暂无记录"}
      </p>
      {data.distanceM !== undefined ? (
        <p className="mt-2 text-xs text-text-muted">
          距查询中心 {Math.round(data.distanceM)} 米
        </p>
      ) : null}
      <p className="mt-2 flex items-center gap-1 text-xs text-text-subtle">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{data.address ?? "地址暂无记录"}</span>
      </p>
      <SourceBadge
        source={data.isDemo ? "supabase_mock" : "housing_history_2024"}
        className="mt-3"
      />
    </>
  );
  return (
    <Link
      href={`/houses/${data.id}`}
      aria-label={`查看房源 ${data.name}`}
      className="glass-panel ui-interactive block rounded-card p-4 outline-none"
    >
      {content}
    </Link>
  );
}

function DealResult({ data }: { data: z.infer<typeof dealSchema> }) {
  return (
    <Link
      href={`/deals/${data.id}`}
      aria-label={`查看团购 ${data.title}`}
      className="glass-panel ui-interactive block rounded-card p-4 outline-none"
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
      className="glass-panel ui-interactive block rounded-card p-4 outline-none"
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

function PlaceResult({ data }: { data: z.infer<typeof placeSchema> }) {
  const href = buildAmapWalkingNavigationUrl({
    destination: data.location,
    destinationName: data.name,
  });
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`在高德地图导航到${data.name}`}
      className="glass-panel ui-interactive block rounded-card p-4 outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Tag>{data.category}</Tag>
          <h3 className="mt-2 text-base font-semibold text-text">
            {data.name}
          </h3>
        </div>
        <strong className="shrink-0 text-sm text-brand">
          {data.distanceM} 米
        </strong>
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-text-muted">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        <span>{data.address}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SourceBadge source="amap" />
        {data.isDemo ? <Tag>接口演示数据</Tag> : null}
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand">
          <Navigation aria-hidden="true" className="size-3.5" />
          去导航
        </span>
      </div>
    </a>
  );
}

const preferenceLabels: Record<PreferenceProposalData["key"], string> = {
  max_housing_budget: "住房月预算上限",
  preferred_areas: "常用区域",
  dietary_restrictions: "饮食限制",
  transport_modes: "交通方式",
  family_profile: "家庭情况",
};

function preferenceValueLabel(data: PreferenceProposalData) {
  return data.key === "max_housing_budget"
    ? `¥${data.value.toLocaleString("zh-CN")} / 月`
    : data.value.join("、");
}

function preferencePatch(data: PreferenceProposalData) {
  switch (data.key) {
    case "max_housing_budget":
      return { maxHousingBudget: data.value };
    case "preferred_areas":
      return { preferredAreas: data.value };
    case "dietary_restrictions":
      return { dietaryRestrictions: data.value };
    case "transport_modes":
      return { transportModes: data.value };
    case "family_profile":
      return { familyProfile: data.value };
  }
}

function defaultNavigate(path: string) {
  window.location.assign(path);
}

function PreferenceProposalResult({
  data,
  navigate,
  returnPath,
}: {
  data: PreferenceProposalData;
  navigate: (path: string) => void;
  returnPath?: string;
}) {
  const [state, setState] = useState<"pending" | "saved" | "cancelled">(
    "pending",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowLongTermMemory: true,
          preferences: preferencePatch(data),
        }),
      });
      if (response.status === 401) {
        const currentPath = safeNextPath(
          returnPath ??
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
          "/xiaozhi",
        );
        navigate(`/login?next=${encodeURIComponent(currentPath)}`);
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(payload?.error?.message ?? "偏好保存失败，请稍后重试");
        return;
      }
      await response.json();
      setState("saved");
      setToast(true);
    } catch {
      setError("网络连接失败，请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="glass-panel rounded-card border-brand/20 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <ShieldQuestion aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand">待你确认的长期偏好</p>
          <h3 className="mt-1 text-base font-semibold text-text">
            {preferenceLabels[data.key]}
          </h3>
          <p className="mt-2 break-words text-sm text-text-muted">
            {preferenceValueLabel(data)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-text-subtle">
        当前只是模型提案，尚未写入 Supabase。确认后仅保存上方这一项。
      </p>
      {state === "pending" ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setState("cancelled");
              setError(null);
            }}
          >
            <X aria-hidden="true" className="size-4" />
            取消
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            <Save aria-hidden="true" className="size-4" />
            {busy ? "正在保存" : "确认保存"}
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className={`mt-4 text-sm ${state === "saved" ? "text-success" : "text-text-muted"}`}
        >
          {state === "saved"
            ? "已由你确认并保存到云端"
            : "已取消，本次没有保存长期偏好"}
        </p>
      )}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-control border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      <Toast
        open={toast}
        onOpenChange={setToast}
        message="偏好已保存到云端"
        duration={0}
      />
    </article>
  );
}

export function AgentResultCards({
  cards,
  navigate = defaultNavigate,
  returnPath,
}: {
  cards: readonly ResultCard[];
  navigate?: (path: string) => void;
  returnPath?: string;
}) {
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
    if (card.kind === "place") {
      const parsed = placeSchema.safeParse(card.data);
      return parsed.success
        ? [<PlaceResult key={`place-${parsed.data.id}`} data={parsed.data} />]
        : [];
    }
    if (card.kind === "preference_proposal") {
      const parsed = preferenceProposalDataSchema.safeParse(card.data);
      return parsed.success
        ? [
            <PreferenceProposalResult
              key={parsed.data.id}
              data={parsed.data}
              navigate={navigate}
              {...(returnPath === undefined ? {} : { returnPath })}
            />,
          ]
        : [];
    }
    return [];
  });
  if (content.length === 0) return null;
  return (
    <section aria-label="查询结果与待确认操作" className="grid gap-3">
      {content}
    </section>
  );
}
