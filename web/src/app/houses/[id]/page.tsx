import { notFound } from "next/navigation";

import { HouseDetail } from "@/components/business/house-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

interface HouseDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function HouseDetailRoute({
  params,
}: HouseDetailRouteProps) {
  const { id } = await params;
  const repositories = await createRepositories();
  const house = await repositories.business.getHouse(id);

  if (!house) notFound();

  return (
    <DetailShell title="房源详情" backHref="/houses">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <HouseDetail house={house} />
    </DetailShell>
  );
}
