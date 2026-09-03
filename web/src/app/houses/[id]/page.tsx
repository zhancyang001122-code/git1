import { notFound } from "next/navigation";

import {
  HistoricalHouseDetail,
  HouseDetail,
  SocialHousingLeadDetail,
} from "@/components/business/house-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";
import { createHousingRuntime } from "@/features/housing/runtime";
import { createSocialHousingRuntime } from "@/features/social-housing/runtime";

interface HouseDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function HouseDetailRoute({
  params,
}: HouseDetailRouteProps) {
  const { id } = await params;
  const repositories = await createRepositories();
  const house = await repositories.business.getHouse(id);
  const historicalHouse = house
    ? null
    : await createHousingRuntime().service?.getById?.(id);
  const socialHouse =
    house || historicalHouse
      ? null
      : await createSocialHousingRuntime().service?.getById?.(id);

  if (!house && !historicalHouse && !socialHouse) notFound();

  return (
    <DetailShell title="房源详情" backHref="/houses">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      {house ? <HouseDetail house={house} /> : null}
      {historicalHouse ? (
        <HistoricalHouseDetail house={historicalHouse} />
      ) : null}
      {socialHouse ? <SocialHousingLeadDetail lead={socialHouse} /> : null}
    </DetailShell>
  );
}
