import { DetailShell } from "@/components/layout/detail-shell";
import { NearbyExperience } from "@/components/market/nearby-experience";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function NearbyPage() {
  const repositories = await createRepositories();
  const stores = await repositories.business.listStores();
  return (
    <DetailShell title="周边服务" backHref="/">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <NearbyExperience stores={stores} />
    </DetailShell>
  );
}
