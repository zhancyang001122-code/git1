"use client";

import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  LoaderCircle,
} from "lucide-react";

import { SourceBadge } from "@/components/ui/source-badge";
import type { PublicToolProgress } from "@/features/agent/chat-events";

const statusPresentation = {
  queued: {
    label: "等待处理",
    icon: CircleDashed,
    className: "text-text-muted",
  },
  running: {
    label: "处理中",
    icon: LoaderCircle,
    className: "animate-spin text-brand",
  },
  succeeded: {
    label: "已完成",
    icon: CheckCircle2,
    className: "text-success",
  },
  failed: {
    label: "未完成",
    icon: CircleAlert,
    className: "text-danger",
  },
  timed_out: {
    label: "已超时",
    icon: CircleAlert,
    className: "text-warning",
  },
} as const;

export function AgentProgressList({
  items,
}: {
  items: readonly PublicToolProgress[];
}) {
  if (items.length === 0) return null;

  const current =
    [...items].reverse().find((item) => item.status === "running") ??
    items.at(-1)!;
  const presentation = statusPresentation[current.status];
  const Icon = presentation.icon;
  const streaming = current.status === "queued" || current.status === "running";

  return (
    <section
      aria-label="处理进度"
      aria-live="polite"
      aria-atomic="true"
      className="glass-panel h-[108px] overflow-hidden rounded-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">
          {streaming ? "小智正在处理" : "本轮处理状态"}
        </h2>
        <span className="text-xs tabular-nums text-text-subtle">
          {items.indexOf(current) + 1}/{items.length}
        </span>
      </div>
      <div key={current.id} className="mt-3 flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={`mt-0.5 size-4 shrink-0 ${presentation.className}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 items-center text-sm font-medium leading-5 text-text">
              <span className="truncate">{current.label}</span>
              {streaming ? (
                <span
                  data-testid="streaming-ellipsis"
                  aria-hidden="true"
                  className="ml-1 inline-flex shrink-0 items-end gap-0.5"
                >
                  <span className="status-dot size-1 rounded-full bg-brand" />
                  <span className="status-dot size-1 rounded-full bg-brand" />
                  <span className="status-dot size-1 rounded-full bg-brand" />
                </span>
              ) : null}
            </p>
            <span className="shrink-0 text-xs text-text-subtle">
              {presentation.label}
            </span>
          </div>
          <SourceBadge source={current.source} className="mt-1.5" />
        </div>
      </div>
    </section>
  );
}
