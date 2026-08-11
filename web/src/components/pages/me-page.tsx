import {
  Bookmark,
  Clock3,
  FileClock,
  Heart,
  History,
  MapPin,
  MessageSquareText,
  PackageCheck,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Cell, CellGroup } from "@/components/ui/cell-group";
import { Tag } from "@/components/ui/tag";
import { demoProfile } from "@/features/account/demo-account-data";

import { AccountUtilityActions } from "./account-utility-actions";

const stats = [
  {
    label: "我的收藏",
    value: demoProfile.savedCount,
    href: "/me/favorites",
    icon: Heart,
  },
  {
    label: "浏览历史",
    value: demoProfile.historyCount,
    href: "/me/history",
    icon: History,
  },
  {
    label: "演示订单",
    value: demoProfile.orderCount,
    href: "/me/orders",
    icon: PackageCheck,
  },
  {
    label: "对话历史",
    value: demoProfile.conversationCount,
    href: "/xiaozhi/history",
    icon: MessageSquareText,
  },
] as const;

const entries = [
  {
    label: "地址管理",
    description: "演示地址与定位边界",
    href: "/me/addresses",
    icon: MapPin,
  },
  {
    label: "小智偏好",
    description: "预算、区域、交通和饮食",
    href: "/me/preferences",
    icon: SlidersHorizontal,
  },
  {
    label: "知识纠错与反馈",
    description: "提交待审核演示反馈",
    href: "/me/feedback",
    icon: Bookmark,
  },
  {
    label: "浏览与对话历史",
    description: "统一查看演示记录",
    href: "/me/history",
    icon: FileClock,
  },
] as const;

export function MePage({
  accountNavigate,
}: {
  accountNavigate?: (path: string) => void;
} = {}) {
  return (
    <AppShell activeNav="me" header={<PageHeader title="我的" />}>
      <div className="space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft to-accent/10 p-4">
          <div className="flex items-center gap-4">
            <div className="relative size-14 overflow-hidden rounded-full bg-white">
              <Image
                fill
                src="/images/home/xiaozhi-mascot.png"
                alt=""
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-text">
                {demoProfile.name}
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                {demoProfile.city} · 匿名演示用户
              </p>
              <Tag className="mt-2">前端演示档案</Tag>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-1 border-t border-brand/10 pt-3">
            {stats.map(({ href, icon: Icon, label, value }) => (
              <Link
                key={label}
                href={href}
                aria-label={`${label} ${value}`}
                className="flex min-h-16 flex-col items-center justify-center rounded-control px-1 text-center outline-none hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Icon aria-hidden="true" className="size-4 text-brand" />
                <strong className="mt-1 text-base text-text">{value}</strong>
                <span className="text-xs text-text-muted">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="profile-preferences" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="profile-preferences"
              className="text-lg font-semibold text-text"
            >
              小智偏好
            </h2>
            <Link
              href="/me/preferences"
              className="text-xs font-medium text-brand"
            >
              管理偏好
            </Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-card bg-surface">
            <p className="p-4 text-sm text-text-muted">
              预算上限
              <br />
              <strong className="text-text">{demoProfile.budgetLabel}</strong>
            </p>
            <p className="p-4 text-sm text-text-muted">
              交通方式
              <br />
              <strong className="text-text">
                {demoProfile.transportLabel}
              </strong>
            </p>
            <p className="p-4 text-sm text-text-muted">
              常用区域
              <br />
              <strong className="text-text">{demoProfile.areaLabel}</strong>
            </p>
            <p className="p-4 text-sm text-text-muted">
              饮食偏好
              <br />
              <strong className="text-text">{demoProfile.foodLabel}</strong>
            </p>
          </div>
        </section>

        <CellGroup title="账户功能">
          {entries.map(({ description, href, icon: Icon, label }) => (
            <Cell
              key={label}
              title={label}
              description={description}
              href={href}
              icon={<Icon aria-hidden="true" className="size-5" />}
            />
          ))}
        </CellGroup>

        <AccountUtilityActions navigate={accountNavigate} />

        <p className="flex items-center justify-center gap-1 text-xs text-text-subtle">
          <Clock3 aria-hidden="true" className="size-3.5" />
          数据仅用于作品集演示
        </p>
      </div>
    </AppShell>
  );
}
