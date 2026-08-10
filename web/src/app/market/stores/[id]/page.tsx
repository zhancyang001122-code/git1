import { notFound } from "next/navigation";

import { DetailShell } from "@/components/layout/detail-shell";
import { StoreDetail } from "@/components/market/store-detail";
import { demoProducts, demoStores } from "@/features/business/demo-data";

export function generateStaticParams() {
  return demoStores.map((store) => ({ id: store.id }));
}

export default async function StoreDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = demoStores.find((item) => item.id === id);
  if (!store) notFound();
  return (
    <DetailShell title="门店详情" backHref="/market">
      <StoreDetail
        store={store}
        products={demoProducts.filter(
          (product) => product.storeId === store.id,
        )}
      />
    </DetailShell>
  );
}
