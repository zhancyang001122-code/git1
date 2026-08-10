import { DetailShell } from "@/components/layout/detail-shell";
import { MarketExperience } from "@/components/market/market-experience";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function MarketPage() {
  const repositories = await createRepositories();
  const stores = await repositories.business.listStores();
  const products = await repositories.business.listProducts({ limit: 24 });
  return (
    <DetailShell title="线上超市" backHref="/">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <MarketExperience stores={stores} products={products.items} />
    </DetailShell>
  );
}
