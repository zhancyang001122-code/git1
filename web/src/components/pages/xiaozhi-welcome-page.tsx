"use client";

import {
  BookOpenCheck,
  Building2,
  Database,
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
  const flagshipPrompt = `我预算3500元，想找${location.name}附近的一居室。请查询2024年历史房源，再找附近的地铁和超市，并说明签约前需要核验哪些信息、是否需要办理网签备案。`;
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

        <section
          aria-labelledby="rental-demo-title"
          className="glass-panel overflow-hidden rounded-feature border border-brand/15"
        >
          <div className="bg-gradient-to-br from-brand-soft/90 to-white/80 p-4">
            <p className="text-xs font-semibold text-brand">租房决策主演示</p>
            <h2
              id="rental-demo-title"
              className="mt-1 text-lg font-bold leading-7 text-text"
            >
              一个问题，串起三类真实能力
            </h2>
            <p className="mt-1 text-sm leading-[22px] text-text-muted">
              预算 3500 元 · 一居室 · {location.name}附近 · 地铁和超市 ·
              签约核验
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border border-y border-border bg-white/55">
            {[
              { icon: Database, label: "房源", detail: "Supabase" },
              { icon: MapPinned, label: "周边", detail: "高德" },
              { icon: BookOpenCheck, label: "规则", detail: "RAG 引用" },
            ].map(({ detail, icon: Icon, label }) => (
              <div key={label} className="px-2 py-3 text-center">
                <Icon
                  aria-hidden="true"
                  className="mx-auto size-4 text-brand"
                />
                <p className="mt-1 text-xs font-semibold text-text">{label}</p>
                <p className="mt-0.5 text-xs text-text-subtle">{detail}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <Link
              href={`/xiaozhi/chat?q=${encodeURIComponent(flagshipPrompt)}`}
              className="ui-interactive inline-flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-3 text-sm font-semibold text-white outline-none hover:bg-brand-strong"
            >
              运行完整任务
            </Link>
            <Link
              href="/case-study"
              className="glass-control ui-interactive inline-flex min-h-11 items-center justify-center rounded-control border px-3 text-sm font-semibold text-brand outline-none hover:bg-brand-soft"
            >
              为什么这样设计
            </Link>
          </div>
        </section>

        <section aria-labelledby="xiaozhi-tasks" className="space-y-3">
          <SectionHeader id="xiaozhi-tasks" title="其他可用能力" />
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
