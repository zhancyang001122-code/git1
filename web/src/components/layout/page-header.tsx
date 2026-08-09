import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, leading, actions }: PageHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <h1 className="truncate text-lg font-semibold text-text">{title}</h1>
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
