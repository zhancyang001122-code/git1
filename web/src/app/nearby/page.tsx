import { DetailShell } from "@/components/layout/detail-shell";
import { NearbyExperience } from "@/components/market/nearby-experience";

export default function NearbyPage() {
  return (
    <DetailShell title="周边服务" backHref="/">
      <NearbyExperience />
    </DetailShell>
  );
}
