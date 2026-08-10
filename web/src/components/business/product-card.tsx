import { PackageCheck, PackageX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BusinessCardImage } from "@/components/business/business-card-image";
import { SourceBadge } from "@/components/ui/source-badge";
import type { Product } from "@/features/business/domain";

export interface ProductCardProps {
  product: Product;
  actions?: ReactNode;
  eager?: boolean;
}

export function ProductCard({ actions, eager, product }: ProductCardProps) {
  const inStock = product.availableStock > 0;

  return (
    <article className="group overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <Link
        href={`/market/products/${product.id}`}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <BusinessCardImage
          src={product.imageSrc}
          alt={`${product.name}的演示商品图片`}
          sizes="(max-width: 430px) 50vw, 215px"
          className="aspect-square"
          eager={eager}
        />
        <div className="space-y-2 p-3">
          <p className="text-xs font-medium text-brand">{product.category}</p>
          <h2 className="line-clamp-2 text-base font-semibold leading-6 text-text">
            {product.name}
          </h2>
          <div className="flex items-center justify-between gap-2">
            <strong className="text-base text-danger">¥{product.price}</strong>
            <span
              className={`flex items-center gap-1 text-xs ${inStock ? "text-success" : "text-danger"}`}
            >
              {inStock ? (
                <PackageCheck aria-hidden="true" className="size-3.5" />
              ) : (
                <PackageX aria-hidden="true" className="size-3.5" />
              )}
              {inStock ? `演示库存 ${product.availableStock}` : "演示缺货"}
            </span>
          </div>
          <SourceBadge source="supabase_mock" />
        </div>
      </Link>
      {actions ? (
        <div className="border-t border-border p-3">{actions}</div>
      ) : null}
    </article>
  );
}
