import { DealListExperience } from "@/components/business/deal-list-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { SourceBadge } from "@/components/ui/source-badge";
import { createDemoRepository } from "@/features/business/demo-repository";

export default async function DealsPage() {
  const result = await createDemoRepository().listDeals({ limit: 24 });

  return (
    <DetailShell
      title="团购"
      backHref="/"
      actions={<SourceBadge source="supabase_mock" />}
    >
      <DealListExperience deals={result.items} />
    </DetailShell>
  );
}
