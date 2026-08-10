import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface DemoNoticeProps {
  children: ReactNode;
  className?: string;
}

export function DemoNotice({ children, className }: DemoNoticeProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-control border-l-4 border-brand bg-surface px-3 py-2.5 text-sm leading-5 text-text-muted",
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
      <span>{children}</span>
    </div>
  );
}
