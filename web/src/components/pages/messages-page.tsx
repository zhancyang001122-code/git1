"use client";

import { Bell, Bot, MessageCircleMore, TicketPercent } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SourceBadge } from "@/components/ui/source-badge";
import {
  demoMessages,
  type DemoMessageCategory,
} from "@/features/account/demo-account-data";

type MessageTab = "all" | DemoMessageCategory;

const tabs: readonly { key: MessageTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "system", label: "系统" },
  { key: "xiaozhi", label: "小智" },
  { key: "interaction", label: "互动" },
];

const messageIcons = {
  system: Bell,
  xiaozhi: Bot,
  interaction: MessageCircleMore,
} as const;

export function MessagesPage() {
  const [tab, setTab] = useState<MessageTab>("all");
  const messages = demoMessages.filter(
    (message) => tab === "all" || message.category === tab,
  );

  return (
    <AppShell activeNav="messages" header={<PageHeader title="消息" />}>
      <div className="space-y-4 px-4 py-4">
        <div aria-label="消息分类" className="grid grid-cols-4 gap-2">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              className={`min-h-11 rounded-full text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand ${tab === key ? "bg-brand text-white" : "bg-surface text-text-muted"}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <section aria-label="消息列表" className="space-y-3">
          {messages.map((message) => {
            const Icon = messageIcons[message.category];
            return (
              <article
                key={message.id}
                className="flex gap-3 rounded-card border border-border bg-surface p-4 shadow-card"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-6 text-text">
                      {message.title}
                    </h2>
                    <span className="shrink-0 text-xs text-text-subtle">
                      {message.timeLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    {message.summary}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <SourceBadge source="supabase_mock" />
                    {message.unread ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs leading-5 text-white">
                        {message.unread}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <p className="flex items-center justify-center gap-2 py-3 text-xs text-text-subtle">
          <TicketPercent aria-hidden="true" className="size-4" />
          以上均为演示消息
        </p>
      </div>
    </AppShell>
  );
}
