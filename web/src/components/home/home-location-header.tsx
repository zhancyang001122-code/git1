import { MapPin } from "lucide-react";

import { Tag } from "@/components/ui/tag";

export function HomeLocationHeader() {
  return (
    <header className="flex h-14 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MapPin aria-hidden="true" className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-text-subtle">当前展示位置</p>
          <p className="truncate text-sm font-semibold text-text">
            杭州 · 武林广场
          </p>
        </div>
      </div>
      <Tag className="shrink-0">演示定位</Tag>
    </header>
  );
}
