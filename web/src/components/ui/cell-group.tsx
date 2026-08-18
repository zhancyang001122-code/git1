import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface CellGroupProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function CellGroup({ title, children, className }: CellGroupProps) {
  return (
    <section
      role="group"
      aria-label={title}
      className={cn("space-y-2", className)}
    >
      <h2 className="px-1 text-sm font-medium text-text-muted">{title}</h2>
      <div className="glass-panel divide-y divide-border overflow-hidden rounded-card">
        {children}
      </div>
    </section>
  );
}

export interface CellProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

export function Cell({
  title,
  description,
  meta,
  icon,
  href,
  onClick,
  danger = false,
}: CellProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      {icon ? (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block truncate text-sm font-medium text-text",
            danger && "text-danger",
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-sm text-text-muted">{meta}</span>
      ) : null}
      {interactive ? (
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-text-subtle"
        />
      ) : null}
    </>
  );
  const className =
    "ui-interactive flex min-h-14 w-full items-center gap-3 border border-transparent bg-transparent px-4 py-2.5 outline-none motion-reduce:transition-none hover:bg-brand-soft/60";

  if (href)
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}
