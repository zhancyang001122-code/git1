import { HomeHighlights } from "@/components/home/home-highlights";
import { HomeLocationHeader } from "@/components/home/home-location-header";
import { HomeSearchExperience } from "@/components/home/home-search-experience";
import { ServiceEntryGrid } from "@/components/home/service-entry-grid";
import { XiaozhiHero } from "@/components/home/xiaozhi-hero";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { homeHighlights } from "@/features/home/home-demo-data";

export function HomePage() {
  return (
    <AppShell activeNav="home" header={<PageHeader title="小智本地生活" />}>
      <div className="space-y-4 px-4 py-3">
        <HomeLocationHeader />
        <HomeSearchExperience />
        <XiaozhiHero />
        <ServiceEntryGrid />
        <HomeHighlights items={homeHighlights} />
      </div>
    </AppShell>
  );
}
