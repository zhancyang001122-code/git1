import { DealListExperience } from "@/components/business/deal-list-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { SourceBadge } from "@/components/ui/source-badge";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function DealsPage() {
  const repositories = await createRepositories();
  const result = await repositories.business.listDeals({ limit: 24 });

  return (
    <DetailShell
      title="团购"
      backHref="/"
      actions={<SourceBadge source="supabase_mock" />}
    >
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <DealListExperience deals={result.items} />
    </DetailShell>
  );
}
