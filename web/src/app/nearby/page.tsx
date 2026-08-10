import { DetailShell } from "@/components/layout/detail-shell";
import { NearbyExperience } from "@/components/market/nearby-experience";
import { demoStores } from "@/features/business/demo-data";

export default function NearbyPage() {
  return (
    <DetailShell title="周边服务" backHref="/">
      <NearbyExperience stores={demoStores} />
    </DetailShell>
  );
}
