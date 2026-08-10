import { DetailShell } from "@/components/layout/detail-shell";
import { MarketExperience } from "@/components/market/market-experience";
import { demoProducts, demoStores } from "@/features/business/demo-data";

export default function MarketPage() {
  return (
    <DetailShell title="线上超市" backHref="/">
      <MarketExperience stores={demoStores} products={demoProducts} />
    </DetailShell>
  );
}
