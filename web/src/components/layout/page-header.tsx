import type { ReactNode } from "react";

import { MiniProgramCapsule } from "@/components/layout/mini-program-capsule";

export interface PageHeaderProps {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, leading, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="grid h-12 grid-cols-[84px_minmax(0,1fr)_84px] items-center gap-2 px-3">
        <div className="flex min-w-0 items-center">{leading}</div>
        <h1 className="truncate text-center text-lg font-semibold text-text">
          {title}
        </h1>
        <MiniProgramCapsule />
      </div>
      {actions ? (
        <div className="flex min-h-9 items-center justify-end border-t border-border/70 px-4 py-1.5">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
