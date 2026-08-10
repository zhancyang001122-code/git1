import { notFound } from "next/navigation";

import { DealDetail } from "@/components/business/deal-detail";
import { DetailShell } from "@/components/layout/detail-shell";
import { demoDeals } from "@/features/business/demo-data";
import { createDemoRepository } from "@/features/business/demo-repository";

interface DealDetailRouteProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return demoDeals.map((deal) => ({ id: deal.id }));
}

export default async function DealDetailRoute({
  params,
}: DealDetailRouteProps) {
  const { id } = await params;
  const deal = await createDemoRepository().getDeal(id);

  if (!deal) notFound();

  return (
    <DetailShell title="团购详情" backHref="/deals">
      <DealDetail deal={deal} />
    </DetailShell>
  );
}
