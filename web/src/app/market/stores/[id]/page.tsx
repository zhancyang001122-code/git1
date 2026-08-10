import { notFound } from "next/navigation";

import { DetailShell } from "@/components/layout/detail-shell";
import { StoreDetail } from "@/components/market/store-detail";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function StoreDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repositories = await createRepositories();
  const store = await repositories.business.getStore(id);
  if (!store) notFound();
  const products = await repositories.business.listProducts({
    storeId: store.id,
    limit: 24,
  });
  return (
    <DetailShell title="门店详情" backHref="/market">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <StoreDetail store={store} products={products.items} />
    </DetailShell>
  );
}
