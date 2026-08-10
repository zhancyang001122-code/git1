import {
  Building2,
  MapPinned,
  MessageSquareText,
  ShoppingBasket,
  Soup,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SectionHeader } from "@/components/ui/section-header";

const tasks = [
  {
    label: "找宠物友好房源",
    prompt: "找3500以内允许养猫的一居室",
    icon: Building2,
  },
  {
    label: "附近适合两个人吃饭",
    prompt: "附近适合两个人吃饭的地方",
    icon: Soup,
  },
  {
    label: "今晚买点菜",
    prompt: "帮我准备一份番茄牛肉面购物清单",
    icon: ShoppingBasket,
  },
  {
    label: "团购退款怎么退",
    prompt: "未使用团购券可以退款吗",
    icon: MessageSquareText,
  },
  {
    label: "帮我推荐周末去处",
    prompt: "推荐一条杭州周末散步路线",
    icon: MapPinned,
  },
] as const;

export function XiaozhiWelcomePage() {
  return (
    <AppShell activeNav="xiaozhi" header={<PageHeader title="小智" />}>
      <div className="space-y-5 px-4 py-4">
        <section className="grid grid-cols-[1fr_112px] items-center gap-3 overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft to-accent/10 p-5">
          <div>
            <p className="text-xs font-semibold text-brand">AI 生活助手</p>
            <h2 className="mt-2 text-2xl font-bold leading-8 text-text">
              你好，我是小智
            </h2>
            <p className="mt-2 text-sm leading-[22px] text-text-muted">
              后续会连接房源、地图、商品和正式知识来源。
            </p>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-feature bg-white/70 shadow-floating">
            <Image
              fill
              src="/images/home/xiaozhi-mascot.png"
              alt=""
              sizes="112px"
              loading="eager"
              className="object-contain"
            />
          </div>
        </section>

        <DemoNotice>
          当前为前端演示：快捷任务只携带问题进入本地对话壳，尚未调用真实模型或工具。
        </DemoNotice>

        <section aria-labelledby="xiaozhi-tasks" className="space-y-3">
          <SectionHeader id="xiaozhi-tasks" title="我可以帮你" />
          <div className="grid grid-cols-2 gap-3">
            {tasks.map(({ icon: Icon, label, prompt }, index) => (
              <Link
                key={label}
                href={`/xiaozhi/chat?q=${encodeURIComponent(prompt)}`}
                className={`flex min-h-24 items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand ${index === tasks.length - 1 ? "col-span-2" : ""}`}
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="text-sm font-semibold leading-5 text-text">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="xiaozhi-questions" className="space-y-3">
          <SectionHeader id="xiaozhi-questions" title="你还可以问" />
          <div className="space-y-2">
            {[
              "武林广场附近有哪些演示房源？",
              "团购券过期一定能退吗？",
              "哪些商品当前有演示库存？",
            ].map((question) => (
              <Link
                key={question}
                href={`/xiaozhi/chat?q=${encodeURIComponent(question)}`}
                className="flex min-h-12 items-center justify-between rounded-control border border-border bg-surface px-4 text-sm text-text outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
              >
                {question}
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </section>

        <Link
          href="/xiaozhi/chat"
          className="flex min-h-12 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white shadow-floating outline-none hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          开始演示对话
        </Link>
      </div>
    </AppShell>
  );
}
