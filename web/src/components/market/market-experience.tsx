"use client";

import { Bot, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/business/product-card";
import { StoreCard } from "@/components/business/store-card";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SearchBar } from "@/components/ui/search-bar";
import type { Product, Store } from "@/features/business/domain";
import { useDemoCart } from "@/features/cart/demo-cart";

export function MarketExperience({
  products,
  stores,
}: {
  products: readonly Product[];
  stores: readonly Store[];
}) {
  const { add, itemCount } = useDemoCart();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const categories = [
    "全部",
    ...new Set(products.map((product) => product.category)),
  ];
  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (category === "全部" || product.category === category) &&
          (!query || `${product.name}${product.tags.join("")}`.includes(query)),
      ),
    [category, products, query],
  );

  return (
    <div className="space-y-5 px-4 py-4">
      <DemoNotice>
        价格、库存和配送均为演示业务数据，不连接真实超市。
      </DemoNotice>
      <section className="rounded-feature bg-gradient-to-br from-brand to-brand-strong p-5 text-white shadow-floating">
        <p className="text-sm opacity-80">今日演示采购</p>
        <h2 className="mt-1 text-2xl font-semibold">把一周食材交给小智</h2>
        <Link
          href="/xiaozhi/chat?prompt=帮我生成一周采购清单&source=market"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-control bg-white px-4 text-sm font-semibold text-brand"
        >
          <Bot className="size-4" />
          配菜助手
        </Link>
      </section>
      <SearchBar
        label="搜索演示商品"
        value={queryInput}
        onValueChange={setQueryInput}
        onSubmit={setQuery}
        placeholder="搜索商品"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs ${category === value ? "border-brand bg-brand text-white" : "border-border bg-surface text-text-muted"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">演示门店</h2>
          <Link
            href="/cart"
            className="flex items-center gap-1 text-sm font-medium text-brand"
          >
            <ShoppingCart className="size-4" />
            购物车 {itemCount} 件
          </Link>
        </div>
        <div className="space-y-3">
          {stores
            .filter((store) => store.category === "supermarket")
            .map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">演示商品</h2>
        <div className="grid grid-cols-2 gap-3">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              actions={
                <Button
                  className="w-full px-2"
                  disabled={product.availableStock <= 0}
                  aria-label={
                    product.availableStock > 0 ? "加入购物车" : "演示缺货"
                  }
                  onClick={() => add(product.id)}
                >
                  {product.availableStock > 0 ? "加入购物车" : "演示缺货"}
                </Button>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
