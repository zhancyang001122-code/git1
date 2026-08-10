import { HouseListExperience } from "@/components/business/house-list-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { SourceBadge } from "@/components/ui/source-badge";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function HousesPage() {
  const repositories = await createRepositories();
  const result = await repositories.business.listHouses({ limit: 24 });
  const source =
    repositories.mode.mode === "supabase"
      ? "housing_history_2024"
      : "supabase_mock";

  return (
    <DetailShell
      title="房源列表"
      backHref="/"
      actions={<SourceBadge source={source} />}
    >
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <HouseListExperience houses={result.items} source={source} />
    </DetailShell>
  );
}
