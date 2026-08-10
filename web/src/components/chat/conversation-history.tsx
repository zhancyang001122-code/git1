import { Bot, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";

import { DemoNotice } from "@/components/ui/demo-notice";

const conversations = [
  {
    id: "demo-housing",
    title: "宠物友好房源",
    preview: "3500 元以内的一居室演示筛选",
    time: "今天 10:24",
  },
  {
    id: "demo-refund",
    title: "团购退款规则",
    preview: "演示业务规则与正式知识的区别",
    time: "昨天 19:10",
  },
  {
    id: "demo-grocery",
    title: "番茄牛肉面采购",
    preview: "根据演示库存生成的购物清单",
    time: "8 月 8 日",
  },
  {
    id: "demo-nearby",
    title: "武林广场周边",
    preview: "尚未接入高德实时 POI",
    time: "8 月 7 日",
  },
] as const;

export function ConversationHistory() {
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>以下会话是固定演示记录，不代表已经写入 Supabase。</DemoNotice>
      <section aria-label="演示会话历史" className="space-y-3">
        {conversations.map((item) => (
          <article
            key={item.id}
            className="rounded-card border border-border bg-surface shadow-card"
          >
            <Link
              href={`/xiaozhi/chat/${item.id}`}
              aria-label={`${item.title} ${item.preview}`}
              className="flex min-h-20 items-center gap-3 p-4"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Bot className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-text">
                  {item.title}
                </strong>
                <span className="mt-1 block truncate text-xs text-text-muted">
                  {item.preview}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-text-subtle">
                  <Clock3 className="size-3" />
                  {item.time}
                </span>
              </span>
              <ChevronRight className="size-4 text-text-subtle" />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
