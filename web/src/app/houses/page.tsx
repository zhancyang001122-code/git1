import { HistoricalHouseListExperience } from "@/components/business/historical-house-list-experience";
import { HouseListExperience } from "@/components/business/house-list-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { SourceBadge } from "@/components/ui/source-badge";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function HousesPage() {
  if (!publicEnv().NEXT_PUBLIC_DEMO_MODE) {
    return (
      <DetailShell
        title="房源列表"
        backHref="/"
        actions={<SourceBadge source="housing_history_2024" />}
      >
        <HistoricalHouseListExperience />
      </DetailShell>
    );
  }

  const repositories = await createRepositories();
  const result = await repositories.business.listHouses({ limit: 24 });
  const source =
    result.items.length > 0 && result.items.every((house) => house.isDemo)
      ? "supabase_mock"
      : "housing_history_2024";

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
