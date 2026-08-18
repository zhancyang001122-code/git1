"use client";

import { Bot, CalendarCheck, CreditCard, Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

interface DetailDemoActionsProps {
  entityId: string;
  title: string;
  kind: "house" | "deal";
}

export function DetailDemoActions({
  entityId,
  kind,
  title,
}: DetailDemoActionsProps) {
  const [favorite, setFavorite] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const isHouse = kind === "house";

  function toggleFavorite() {
    setFavorite((value) => !value);
    setNotice("收藏仅保存在当前页面，刷新后会重置。");
  }

  function performPrimaryAction() {
    setNotice(
      isHouse
        ? "这是预约交互演示，不会提交真实预约或联系房东。"
        : "这是购买流程演示，不会创建真实订单或扣款。",
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[48px_1fr_1fr] gap-2">
        <Button
          variant="secondary"
          aria-label={favorite ? "取消收藏" : "收藏"}
          onClick={toggleFavorite}
          className="px-0"
        >
          <Heart
            aria-hidden="true"
            className="size-5"
            fill={favorite ? "currentColor" : "none"}
          />
        </Button>
        <Link
          href={`/xiaozhi/chat?prompt=${encodeURIComponent(`请帮我分析：${title}`)}&source=${kind}&id=${entityId}`}
          className="glass-control ui-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-brand px-3 text-sm font-semibold text-brand outline-none"
        >
          <Bot aria-hidden="true" className="size-4" />
          问小智
        </Link>
        <Button
          onClick={performPrimaryAction}
          aria-label={isHouse ? "预约演示" : "模拟购买"}
        >
          {isHouse ? (
            <CalendarCheck aria-hidden="true" className="size-4" />
          ) : (
            <CreditCard aria-hidden="true" className="size-4" />
          )}
          {isHouse ? "预约演示" : "模拟购买"}
        </Button>
      </div>
      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
        duration={0}
        tone="neutral"
      />
    </div>
  );
}
