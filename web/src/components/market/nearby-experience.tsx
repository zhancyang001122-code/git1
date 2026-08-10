import { Bot, MapPinned, Navigation } from "lucide-react";
import Link from "next/link";

import { StoreCard } from "@/components/business/store-card";
import { DemoNotice } from "@/components/ui/demo-notice";
import type { Store } from "@/features/business/domain";

export function NearbyExperience({ stores }: { stores: readonly Store[] }) {
  return (
    <div className="space-y-5 px-4 py-4">
      <DemoNotice>
        当前使用“杭州武林广场”作为演示中心，未调用高德实时定位、距离或路线。
      </DemoNotice>
      <section className="flex min-h-48 items-center justify-center rounded-feature bg-gradient-to-br from-brand-soft to-accent/10 text-center">
        <div>
          <MapPinned className="mx-auto size-8 text-brand" />
          <h2 className="mt-3 text-lg font-semibold text-text">
            杭州武林广场 · 演示中心
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            地图接入后由高德返回真实 POI 与路线
          </p>
        </div>
      </section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">演示周边商家</h2>
        <Link
          href="/xiaozhi/chat?prompt=帮我找附近服务&source=nearby"
          className="flex items-center gap-1 text-sm font-medium text-brand"
        >
          <Bot className="size-4" />
          问小智
        </Link>
      </div>
      <div className="space-y-3">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </div>
      <div className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
        <Navigation className="mb-2 size-5 text-brand" />
        真实步行路线将在接入高德 Web Service 后展示；当前不伪造距离或耗时。
      </div>
    </div>
  );
}
