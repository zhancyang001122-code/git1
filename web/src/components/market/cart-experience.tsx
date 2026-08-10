"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoNotice } from "@/components/ui/demo-notice";
import { EmptyState } from "@/components/ui/states";
import { Toast } from "@/components/ui/toast";
import type { Product } from "@/features/business/domain";
import { useDemoCart } from "@/features/cart/demo-cart";

export function CartExperience({ products }: { products: readonly Product[] }) {
  const { add, clear, decrease, itemCount, quantities } = useDemoCart();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const lines = products.filter((product) => (quantities[product.id] ?? 0) > 0);
  const total = lines.reduce(
    (sum, product) => sum + product.price * (quantities[product.id] ?? 0),
    0,
  );

  if (lines.length === 0)
    return (
      <div className="space-y-4 px-4 py-4">
        <DemoNotice>购物车仅保存在当前浏览器会话，刷新后会重置。</DemoNotice>
        <EmptyState
          title="购物车还是空的"
          message="从演示超市添加商品后会显示在这里。"
        />
      </div>
    );

  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>购物车仅为前端演示，不会锁定真实库存。</DemoNotice>
      <div className="space-y-3">
        {lines.map((product) => (
          <article
            key={product.id}
            className="rounded-card border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text">
                  {product.name}
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  演示单价 ¥{product.price}
                </p>
              </div>
              <strong className="text-danger">
                ¥{(product.price * (quantities[product.id] ?? 0)).toFixed(2)}
              </strong>
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              <button
                aria-label={`减少 ${product.name}`}
                onClick={() => decrease(product.id)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-border outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Minus className="size-4" />
              </button>
              <span>{quantities[product.id]}</span>
              <button
                aria-label={`增加 ${product.name}`}
                onClick={() => add(product.id)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-border outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="rounded-card bg-surface p-4 shadow-card">
        <p className="flex justify-between text-sm text-text-muted">
          <span>购物车 {itemCount} 件</span>
          <strong className="text-lg text-danger">
            合计 ¥{total.toFixed(2)}
          </strong>
        </p>
        <div className="mt-4 grid grid-cols-[48px_1fr] gap-2">
          <Button
            variant="secondary"
            aria-label="清空购物车"
            onClick={() => setConfirmClear(true)}
            className="px-0"
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            aria-label="模拟结算"
            onClick={() =>
              setNotice("这是结算流程演示，不会创建真实订单、扣款或安排配送。")
            }
          >
            模拟结算
          </Button>
        </div>
      </section>
      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
        duration={0}
        tone="neutral"
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="清空购物车？"
        description="这只会清空当前浏览器会话中的演示商品。"
        confirmLabel="确认清空"
        danger
        onConfirm={clear}
      />
    </div>
  );
}
