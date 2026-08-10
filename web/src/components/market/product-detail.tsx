"use client";

import { PackageCheck, PackageX, Store as StoreIcon } from "lucide-react";
import { useState } from "react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge } from "@/components/ui/source-badge";
import { Tag } from "@/components/ui/tag";
import { Toast } from "@/components/ui/toast";
import type { Product, Store } from "@/features/business/domain";
import { useDemoCart } from "@/features/cart/demo-cart";

export function ProductDetail({
  product,
  store,
}: {
  product: Product;
  store: Store;
}) {
  const { add } = useDemoCart();
  const [notice, setNotice] = useState(false);
  const inStock = product.availableStock > 0;
  return (
    <div className="space-y-5 pb-6">
      <BusinessCardImage
        src={product.imageSrc}
        alt={`${product.name}的演示商品图片`}
        sizes="430px"
        className="aspect-square"
        eager
      />
      <div className="space-y-5 px-4">
        <section className="space-y-3">
          <SourceBadge source="supabase_mock" />
          <h2 className="text-2xl font-semibold text-text">{product.name}</h2>
          <strong className="block text-2xl text-danger">
            ¥{product.price}
          </strong>
          <p className="text-sm leading-6 text-text-muted">
            {product.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </section>
        <section className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <StoreIcon className="size-4 text-brand" />
            {store.name}
          </p>
          <p
            className={`mt-3 flex items-center gap-2 text-sm ${inStock ? "text-success" : "text-danger"}`}
          >
            {inStock ? (
              <PackageCheck className="size-4" />
            ) : (
              <PackageX className="size-4" />
            )}
            {inStock
              ? `演示可用库存 ${product.availableStock}`
              : "演示库存为 0"}
          </p>
        </section>
        <DemoNotice>此页不会创建真实订单、扣款或占用库存。</DemoNotice>
        <Button
          className="w-full"
          disabled={!inStock}
          aria-label={inStock ? "加入购物车" : "演示缺货"}
          onClick={() => {
            add(product.id);
            setNotice(true);
          }}
        >
          {inStock ? "加入购物车" : "演示缺货"}
        </Button>
        <Toast
          open={notice}
          onOpenChange={setNotice}
          message="已加入购物车"
          duration={0}
        />
      </div>
    </div>
  );
}
