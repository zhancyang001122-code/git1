import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  selected?: boolean;
}

export function Tag({ className, selected = false, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-tag px-2.5 py-1 text-xs font-medium",
        selected ? "bg-brand text-white" : "bg-brand-soft text-brand-strong",
        className,
      )}
      {...props}
    />
  );
}
