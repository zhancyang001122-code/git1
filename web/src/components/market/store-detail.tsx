"use client";

import { MapPin, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { ProductCard } from "@/components/business/product-card";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import type { Product, Store } from "@/features/business/domain";
import { useDemoCart } from "@/features/cart/demo-cart";

export function StoreDetail({
  products,
  store,
}: {
  products: readonly Product[];
  store: Store;
}) {
  const { add, itemCount } = useDemoCart();
  return (
    <div className="space-y-5 px-4 py-4">
      <section className="rounded-feature bg-brand-soft p-5">
        <SourceBadge source="supabase_mock" />
        <h2 className="mt-3 text-2xl font-semibold text-text">{store.name}</h2>
        <p className="mt-2 flex items-start gap-2 text-sm text-text-muted">
          <MapPin className="mt-0.5 size-4" />
          {store.district} · {store.address}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          起送价 ¥{store.minimumOrder} ·{" "}
          {store.deliveryMinutes
            ? `演示预计 ${store.deliveryMinutes} 分钟送达`
            : "到店服务演示"}
        </p>
      </section>
      <DemoNotice>门店、配送、价格和库存均为演示业务数据。</DemoNotice>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">商品列表</h2>
        <Link
          href="/cart"
          className="flex items-center gap-1 text-sm text-brand"
        >
          <ShoppingCart className="size-4" />
          {itemCount} 件
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            actions={
              <Button
                className="w-full px-2"
                disabled={product.availableStock <= 0}
                onClick={() => add(product.id)}
              >
                {product.availableStock > 0 ? "加入购物车" : "演示缺货"}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
