import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SectionHeaderProps {
  title: string;
  id?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  action,
  className,
  description,
  id,
  title,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-section-title font-bold text-text">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
