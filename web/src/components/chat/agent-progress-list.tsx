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

  return (
    <section
      aria-label="处理进度"
      aria-live="polite"
      className="rounded-card border border-brand/20 bg-surface p-4 shadow-card"
    >
      <h2 className="text-sm font-semibold text-text">小智处理进度</h2>
      <ol className="mt-3 space-y-3">
        {items.map((item) => {
          const presentation = statusPresentation[item.status];
          const Icon = presentation.icon;
          return (
            <li key={item.id} className="flex items-start gap-3">
              <Icon
                aria-hidden="true"
                className={`mt-0.5 size-4 shrink-0 ${presentation.className}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-5 text-text">
                    {item.label}
                  </p>
                  <span className="shrink-0 text-xs text-text-subtle">
                    {presentation.label}
                  </span>
                </div>
                <SourceBadge source={item.source} className="mt-1.5" />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
