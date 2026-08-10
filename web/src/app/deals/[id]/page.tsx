import { notFound } from "next/navigation";

import { DealDetail } from "@/components/business/deal-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

interface DealDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function DealDetailRoute({
  params,
}: DealDetailRouteProps) {
  const { id } = await params;
  const repositories = await createRepositories();
  const deal = await repositories.business.getDeal(id);

  if (!deal) notFound();

  return (
    <DetailShell title="团购详情" backHref="/deals">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <DealDetail deal={deal} />
    </DetailShell>
  );
}
