import { MapPin } from "lucide-react";

import { Tag } from "@/components/ui/tag";

export function HomeLocationHeader() {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
          <MapPin aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-text-subtle">当前展示位置</p>
          <p className="truncate text-sm font-semibold text-text">
            杭州 · 武林广场
          </p>
        </div>
      </div>
      <Tag className="shrink-0">演示定位</Tag>
    </div>
  );
}
