import type { SourceCode } from "@/components/ui/source-badge";

interface HomeHighlightBase {
  id: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  location: string;
  isDemo: true;
}

export type HomeHighlight =
  | (HomeHighlightBase & {
      kind: "housing";
      source: Extract<SourceCode, "housing_history_2024">;
      historicalYear: 2024;
      priceText: "¥3280/月";
      detail: string;
    })
  | (HomeHighlightBase & {
      kind: "deal";
      source: Extract<SourceCode, "supabase_mock">;
      priceText: "¥128";
      detail: string;
    })
  | (HomeHighlightBase & {
      kind: "product";
      source: Extract<SourceCode, "supabase_mock">;
      priceText: "¥16.9";
      detail: string;
    })
  | (HomeHighlightBase & {
      kind: "community";
      source: Extract<SourceCode, "supabase_mock">;
      author: string;
      detail: string;
    });
