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
        "flex items-start gap-2 rounded-control border border-brand/15 bg-brand-soft px-3 py-2.5 text-sm leading-5 text-brand-strong",
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
