import { HouseListExperience } from "@/components/business/house-list-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { SourceBadge } from "@/components/ui/source-badge";
import { createDemoRepository } from "@/features/business/demo-repository";

export default async function HousesPage() {
  const repository = createDemoRepository();
  const result = await repository.listHouses({ limit: 24 });

  return (
    <DetailShell
      title="房源列表"
      backHref="/"
      actions={<SourceBadge source="housing_history_2024" />}
    >
      <HouseListExperience houses={result.items} />
    </DetailShell>
  );
}
