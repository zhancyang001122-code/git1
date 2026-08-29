"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";

import { LocationPickerSheet } from "@/components/location/location-picker-sheet";
import { useSelectedLocation } from "@/features/location/selected-location-provider";

export function SelectedLocationBar() {
  const { location } = useSelectedLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`选择位置：${location.city} · ${location.name}`}
        onClick={() => setOpen(true)}
        className="glass-control ui-interactive flex min-h-12 w-full items-center justify-between gap-3 rounded-control border px-2 text-left outline-none hover:bg-brand-soft/70"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
            <MapPin
              aria-hidden="true"
              className="size-[18px]"
              strokeWidth={2}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-text-subtle">当前查询位置</span>
            <span className="block truncate text-sm font-semibold text-text">
              {location.city} · {location.name}
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand">
          切换
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      </button>
      {open ? <LocationPickerSheet open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
