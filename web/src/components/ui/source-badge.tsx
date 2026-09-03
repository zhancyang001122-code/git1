import {
  Database,
  History,
  Link2,
  MapPinned,
  Sparkles,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/cn";

export type SourceCode =
  | "housing_history_2024"
  | "social_housing_leads"
  | "supabase_mock"
  | "amap"
  | "knowledge_base"
  | "user_memory";

const sourceLabels: Record<SourceCode, string> = {
  housing_history_2024: "2024 历史房源数据",
  social_housing_leads: "社交平台租房线索",
  supabase_mock: "演示业务数据",
  amap: "高德地图",
  knowledge_base: "知识库",
  user_memory: "已授权偏好",
};

const sourceIcons: Record<SourceCode, typeof History> = {
  housing_history_2024: History,
  social_housing_leads: Link2,
  supabase_mock: Database,
  amap: MapPinned,
  knowledge_base: Sparkles,
  user_memory: UserRound,
};

export interface SourceBadgeProps {
  source: SourceCode;
  className?: string;
}

export function SourceBadge({ className, source }: SourceBadgeProps) {
  const Icon = sourceIcons[source];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-tint px-2 py-1 text-xs font-medium text-text-muted",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
      {sourceLabels[source]}
    </span>
  );
}
