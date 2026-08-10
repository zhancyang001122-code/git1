import { notFound } from "next/navigation";

import { DetailShell } from "@/components/layout/detail-shell";
import { ProductDetail } from "@/components/market/product-detail";
import { demoProducts, demoStores } from "@/features/business/demo-data";

export function generateStaticParams() {
  return demoProducts.map((product) => ({ id: product.id }));
}

export default async function ProductDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = demoProducts.find((item) => item.id === id);
  if (!product) notFound();
  const store = demoStores.find((item) => item.id === product.storeId);
  if (!store) notFound();
  return (
    <DetailShell title="商品详情" backHref="/market">
      <ProductDetail product={product} store={store} />
    </DetailShell>
  );
}
