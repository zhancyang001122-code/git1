import { notFound } from "next/navigation";

import { HouseDetail } from "@/components/business/house-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { demoHouses } from "@/features/business/demo-data";
import { createDemoRepository } from "@/features/business/demo-repository";

interface HouseDetailRouteProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return demoHouses.map((house) => ({ id: house.id }));
}

export default async function HouseDetailRoute({
  params,
}: HouseDetailRouteProps) {
  const { id } = await params;
  const house = await createDemoRepository().getHouse(id);

  if (!house) notFound();

  return (
    <DetailShell title="房源详情" backHref="/houses">
      <HouseDetail house={house} />
    </DetailShell>
  );
}
