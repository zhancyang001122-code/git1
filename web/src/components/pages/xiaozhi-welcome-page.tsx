"use client";

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
import { useSelectedLocation } from "@/features/location/selected-location-provider";

const staticTasks = [
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
] as const;

export function XiaozhiWelcomePage({ mode }: { mode: "demo" | "live" }) {
  const { location } = useSelectedLocation();
  const tasks = [
    {
      label: "找预算内一居室",
      prompt: `找${location.name}附近3500以内的一居室`,
      icon: Building2,
    },
    ...staticTasks,
    {
      label: "帮我推荐周末去处",
      prompt: `推荐一条${location.name}附近的周末散步路线`,
      icon: MapPinned,
    },
  ] as const;
  return (
    <AppShell activeNav="xiaozhi" header={<PageHeader title="小智" />}>
      <div className="space-y-4 px-4 py-3">
        <section className="glass-panel grid grid-cols-[1fr_88px] items-center gap-3 overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft/90 to-accent/10 p-4">
          <div>
            <p className="text-xs font-semibold text-brand">AI 生活助手</p>
            <h2 className="mt-2 text-2xl font-bold leading-8 text-text">
              你好，我是小智
            </h2>
            <p className="mt-1 text-sm leading-[22px] text-text-muted">
              我会调用业务、地图和知识工具，并明确标注结果来源。
            </p>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-feature bg-white/70 shadow-floating">
            <Image
              fill
              src="/images/home/xiaozhi-mascot.png"
              alt=""
              sizes="88px"
              loading="eager"
              className="object-contain"
            />
          </div>
        </section>

        <DemoNotice>
          {mode === "demo"
            ? "当前为可验证演示模式：对话使用本地确定性工具，不会伪装成已连接外部服务。"
            : "当前为 Live 作品集：房源、高德与千问/RAG 已接入真实服务；团购和线上超市仍为明确标注的演示数据。"}
        </DemoNotice>

        <section aria-labelledby="xiaozhi-tasks" className="space-y-3">
          <SectionHeader id="xiaozhi-tasks" title="我可以帮你" />
          <div className="grid grid-cols-2 gap-2.5">
            {tasks.map(({ icon: Icon, label, prompt }, index) => (
              <Link
                key={label}
                href={`/xiaozhi/chat?q=${encodeURIComponent(prompt)}`}
                className={`glass-panel ui-interactive flex min-h-20 items-center gap-2.5 rounded-card p-3 outline-none motion-reduce:transition-none hover:bg-brand-soft/70 ${index === tasks.length - 1 ? "col-span-2" : ""}`}
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
              `${location.name}附近有哪些 2024 年历史房源？`,
              "团购券过期一定能退吗？",
              "哪些商品当前有演示库存？",
            ].map((question) => (
              <Link
                key={question}
                href={`/xiaozhi/chat?q=${encodeURIComponent(question)}`}
                className="glass-control ui-interactive flex min-h-12 items-center justify-between rounded-control border px-4 text-sm text-text outline-none hover:bg-brand-soft/70"
              >
                {question}
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </section>

        <Link
          href="/xiaozhi/chat"
          className="ui-interactive flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-4 text-sm font-semibold text-white outline-none hover:bg-brand-strong"
        >
          {mode === "demo" ? "开始演示对话" : "开始对话"}
        </Link>
      </div>
    </AppShell>
  );
}
