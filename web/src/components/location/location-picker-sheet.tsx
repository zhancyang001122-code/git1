"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import { useState } from "react";

import { ActionSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import {
  resolveBrowserLocation,
  resolveManualLocation,
} from "@/features/location/location-client";
import type { SelectedLocation } from "@/features/location/selected-location";
import { useSelectedLocation } from "@/features/location/selected-location-provider";

interface LocationPickerSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onSelected?(location: SelectedLocation, warning?: string): void;
}

const fieldClass =
  "mt-2 min-h-11 w-full rounded-control border border-border bg-page px-3 text-sm text-text outline-none focus:ring-2 focus:ring-brand";

export function LocationPickerSheet({
  open,
  onOpenChange,
  onSelected,
}: LocationPickerSheetProps) {
  const { location, setLocation } = useSelectedLocation();
  const [city, setCity] = useState(location.city);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"browser" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function commit(
    action: () => Promise<{ location: SelectedLocation; warning?: string }>,
    kind: "browser" | "manual",
  ) {
    setBusy(kind);
    setError(null);
    try {
      const result = await action();
      setLocation(result.location);
      onSelected?.(result.location, result.warning);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "地点选择失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="选择位置"
      description="全站需要位置的功能将使用同一查询中心"
    >
      <div className="space-y-5">
        <section className="rounded-card bg-brand-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text">
            <MapPin aria-hidden="true" className="size-4 text-brand" />
            当前：{location.city} · {location.name}
          </p>
          <p className="mt-2 text-xs leading-5 text-text-muted">
            选择保存在当前浏览器；使用地图或小智时会发送到服务端完成查询，对话会保存最后使用的位置，但不会写成账号长期偏好。明确输入其他地点时，以你的问题为准。
          </p>
        </section>

        <Button
          type="button"
          className="w-full"
          disabled={busy !== null}
          onClick={() => void commit(resolveBrowserLocation, "browser")}
        >
          <LocateFixed aria-hidden="true" className="size-4" />
          {busy === "browser" ? "正在定位" : "使用我的当前位置"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-text-subtle">
          <span className="h-px flex-1 bg-border" />
          或手动选择
          <span className="h-px flex-1 bg-border" />
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void commit(
              () => resolveManualLocation(city.trim(), name.trim()),
              "manual",
            );
          }}
        >
          <label className="block text-sm font-medium text-text">
            城市
            <input
              className={fieldClass}
              value={city}
              maxLength={40}
              required
              placeholder="例如：杭州、绍兴"
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-text">
            地点名称或地址
            <input
              className={fieldClass}
              value={name}
              maxLength={120}
              required
              placeholder="例如：鲁迅故里、武林广场"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={busy !== null || !city.trim() || !name.trim()}
          >
            <Search aria-hidden="true" className="size-4" />
            {busy === "manual" ? "正在解析地点" : "确认手动选择"}
          </Button>
        </form>

        {error ? (
          <p
            role="alert"
            className="rounded-control border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
      </div>
    </ActionSheet>
  );
}
