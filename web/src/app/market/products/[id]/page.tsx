import { notFound } from "next/navigation";

import { DetailShell } from "@/components/layout/detail-shell";
import { ProductDetail } from "@/components/market/product-detail";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function ProductDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repositories = await createRepositories();
  const product = await repositories.business.getProduct(id);
  if (!product) notFound();
  const store = await repositories.business.getStore(product.storeId);
  if (!store) notFound();
  return (
    <DetailShell title="商品详情" backHref="/market">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <ProductDetail product={product} store={store} />
    </DetailShell>
  );
}
