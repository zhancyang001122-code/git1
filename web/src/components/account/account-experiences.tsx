"use client";

import { Clock3, MapPin, PackageCheck, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Toast } from "@/components/ui/toast";
import {
  demoDeals,
  demoHouses,
  demoProducts,
} from "@/features/business/demo-data";

const fieldClass =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text outline-none focus:ring-2 focus:ring-brand";

export function FavoritesExperience() {
  const initial = [
    {
      id: demoHouses[0]!.id,
      title: demoHouses[0]!.name,
      subtitle: `¥${demoHouses[0]!.priceMonthly}/月`,
      href: `/houses/${demoHouses[0]!.id}`,
      source: "housing_history_2024" as const,
    },
    {
      id: demoDeals[0]!.id,
      title: demoDeals[0]!.title,
      subtitle: `演示价 ¥${demoDeals[0]!.salePrice}`,
      href: `/deals/${demoDeals[0]!.id}`,
      source: "supabase_mock" as const,
    },
    {
      id: demoProducts[0]!.id,
      title: demoProducts[0]!.name,
      subtitle: `演示价 ¥${demoProducts[0]!.price}`,
      href: `/market/products/${demoProducts[0]!.id}`,
      source: "supabase_mock" as const,
    },
  ];
  const [items, setItems] = useState(initial);
  const [notice, setNotice] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>收藏列表为固定演示数据，尚未读取用户账户。</DemoNotice>
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <Link href={item.href} className="block">
            <h2 className="text-base font-semibold text-text">{item.title}</h2>
            <p className="mt-1 text-sm text-text-muted">{item.subtitle}</p>
            <SourceBadge source={item.source} className="mt-3" />
          </Link>
          <Button
            variant="ghost"
            aria-label="移除收藏"
            className="mt-3"
            onClick={() => setPendingId(item.id)}
          >
            <Trash2 className="size-4" />
            移除
          </Button>
        </article>
      ))}
      <Toast
        open={notice}
        onOpenChange={setNotice}
        message="该条目仅从当前页面移除，没有修改 Supabase 数据。"
        duration={0}
        tone="neutral"
      />
      <ConfirmDialog
        open={Boolean(pendingId)}
        onOpenChange={(open) => {
          if (!open) setPendingId(null);
        }}
        title="移除这条收藏？"
        description="只会修改当前页面状态，不会写入 Supabase。"
        confirmLabel="确认移除"
        danger
        onConfirm={() => {
          if (!pendingId) return;
          setItems((current) =>
            current.filter((entry) => entry.id !== pendingId),
          );
          setNotice(true);
        }}
      />
    </div>
  );
}

const historyItems = [
  {
    title: "查看武林晴川一居室",
    href: `/houses/${demoHouses[0]!.id}`,
    time: "今天 10:24",
  },
  {
    title: "询问宠物友好房源",
    href: "/xiaozhi/chat/demo-housing",
    time: "今天 10:20",
  },
  {
    title: "浏览山野火锅双人餐",
    href: `/deals/${demoDeals[0]!.id}`,
    time: "昨天 19:10",
  },
  {
    title: "查看番茄 500g",
    href: `/market/products/${demoProducts[3]!.id}`,
    time: "8 月 8 日",
  },
] as const;

export function AccountHistoryExperience() {
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>浏览与对话历史均为演示记录。</DemoNotice>
      {historyItems.map((item) => (
        <article
          key={item.title}
          className="rounded-card border border-border bg-surface shadow-card"
        >
          <Link
            href={item.href}
            className="flex min-h-16 items-center gap-3 p-4"
          >
            <Clock3 className="size-5 text-brand" />
            <span className="flex-1">
              <strong className="block text-sm text-text">{item.title}</strong>
              <span className="text-xs text-text-subtle">{item.time}</span>
            </span>
          </Link>
        </article>
      ))}
    </div>
  );
}

const orders = [
  "山野火锅双人餐",
  "湖畔咖啡下午茶",
  "番茄牛肉面采购",
  "亲子乐园家庭票",
  "影院双人通兑券",
];
export function OrdersExperience() {
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>
        以下均为演示订单，不存在真实支付、核销或退款状态。
      </DemoNotice>
      {orders.map((title, index) => (
        <article
          key={title}
          className="rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <div className="flex justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text">{title}</h2>
              <p className="mt-1 text-xs text-text-muted">
                DEMO-ORDER-{String(index + 1).padStart(3, "0")}
              </p>
            </div>
            <span className="text-xs text-brand">
              {index % 2 ? "演示已完成" : "演示待使用"}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-1 text-xs text-text-subtle">
            <PackageCheck className="size-3.5" />
            不支持真实售后
          </p>
        </article>
      ))}
    </div>
  );
}

export function AddressesExperience() {
  const [items, setItems] = useState(["杭州市拱墅区武林广场演示地址"]);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>地址为脱敏演示信息，不会用于定位或配送。</DemoNotice>
      {items.map((item) => (
        <article
          key={item}
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4"
        >
          <MapPin className="size-5 text-brand" />
          <p className="flex-1 text-sm text-text">{item}</p>
        </article>
      ))}
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          setItems((current) => [
            ...current,
            `杭州市西湖区新增演示地址 ${current.length + 1}`,
          ]);
          setNotice("新增地址仅保存在当前页面，没有写入 Supabase。");
        }}
      >
        <Plus className="size-4" />
        新增演示地址
      </Button>
      {notice ? <DemoNotice>{notice}</DemoNotice> : null}
    </div>
  );
}

export function PreferencesExperience() {
  const [budget, setBudget] = useState("3500");
  const [pet, setPet] = useState("可以养猫");
  const [area, setArea] = useState("武林广场");
  const [food, setFood] = useState("不吃辣");
  const [notice, setNotice] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(true);
      }}
      className="space-y-4 px-4 py-4"
    >
      <DemoNotice>偏好只用于演示表单，不会自动成为长期记忆。</DemoNotice>
      <label className="block text-sm font-medium text-text">
        预算上限
        <input
          aria-label="预算上限"
          type="number"
          min="0"
          max="50000"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          className={`${fieldClass} mt-2`}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        宠物偏好
        <select
          value={pet}
          onChange={(event) => setPet(event.target.value)}
          className={`${fieldClass} mt-2`}
        >
          <option>可以养猫</option>
          <option>不养宠物</option>
          <option>需要进一步确认</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-text">
        常用区域
        <input
          value={area}
          onChange={(event) => setArea(event.target.value)}
          className={`${fieldClass} mt-2`}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        饮食偏好
        <input
          value={food}
          onChange={(event) => setFood(event.target.value)}
          className={`${fieldClass} mt-2`}
        />
      </label>
      <Button type="submit" aria-label="保存演示偏好" className="w-full">
        保存演示偏好
      </Button>
      {notice ? (
        <DemoNotice>
          本地表单已更新，但没有写入 Supabase；正式版本需用户授权后持久化。
        </DemoNotice>
      ) : null}
    </form>
  );
}

export function FeedbackExperience() {
  const [suggestion, setSuggestion] = useState("");
  const [notice, setNotice] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (suggestion.trim()) setNotice(true);
  }
  return (
    <form onSubmit={submit} className="space-y-4 px-4 py-4">
      <DemoNotice>用户反馈不能直接发布为知识，必须进入人工审核。</DemoNotice>
      <label className="block text-sm font-medium text-text">
        关联消息
        <select className={`${fieldClass} mt-2`}>
          <option>团购退款演示回答</option>
          <option>宠物友好房源演示回答</option>
          <option>配送时效演示回答</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-text">
        错误类型
        <select className={`${fieldClass} mt-2`}>
          <option>条件不完整</option>
          <option>事实错误</option>
          <option>引用不匹配</option>
          <option>知识已过期</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-text">
        纠正建议
        <textarea
          aria-label="纠正建议"
          required
          maxLength={500}
          value={suggestion}
          onChange={(event) => setSuggestion(event.target.value)}
          className={`${fieldClass} mt-2 min-h-28 py-3`}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        证据说明
        <input
          className={`${fieldClass} mt-2`}
          placeholder="演示证据编号或说明"
        />
      </label>
      <Button
        type="submit"
        aria-label="提交演示反馈"
        disabled={!suggestion.trim()}
        className="w-full"
      >
        提交演示反馈
      </Button>
      {notice ? (
        <DemoNotice>
          反馈仅生成待审核候选，没有写入数据库，更没有发布为正式知识。
        </DemoNotice>
      ) : null}
    </form>
  );
}
