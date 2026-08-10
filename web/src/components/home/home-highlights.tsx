import { HomeHighlightCard } from "@/components/home/home-highlight-card";
import { SectionHeader } from "@/components/ui/section-header";
import type { HomeHighlight } from "@/features/home/home-types";

export interface HomeHighlightsProps {
  items: readonly HomeHighlight[];
}

export function HomeHighlights({ items }: HomeHighlightsProps) {
  return (
    <section aria-labelledby="home-highlights-title" className="space-y-3">
      <SectionHeader
        id="home-highlights-title"
        title="附近精选"
        description="历史数据与演示内容会明确标注来源"
      />
      <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
        {items.map((item) => (
          <HomeHighlightCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
