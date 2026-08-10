import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";

export interface DetailShellProps {
  title: string;
  children: ReactNode;
  backHref?: string;
  actions?: ReactNode;
}

export function DetailShell({
  actions,
  backHref = "/",
  children,
  title,
}: DetailShellProps) {
  const back = (
    <Link
      href={backHref}
      aria-label="返回"
      className="inline-flex size-11 items-center justify-center rounded-full text-text-muted outline-none hover:bg-brand-soft hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </Link>
  );

  return (
    <AppShell
      activeNav="home"
      hideBottomNav
      header={<PageHeader title={title} leading={back} actions={actions} />}
    >
      {children}
    </AppShell>
  );
}
