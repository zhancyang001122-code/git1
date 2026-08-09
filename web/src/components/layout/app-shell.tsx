import type { ReactNode } from "react";

import {
  BottomNavigation,
  type MainNavKey,
} from "@/components/layout/bottom-navigation";
import { MobileCanvas } from "@/components/layout/mobile-canvas";
import { cn } from "@/lib/cn";

export interface AppShellProps {
  children: ReactNode;
  activeNav: MainNavKey;
  header?: ReactNode;
  hideBottomNav?: boolean;
}

export function AppShell({
  children,
  activeNav,
  header,
  hideBottomNav = false,
}: AppShellProps) {
  return (
    <MobileCanvas className="flex flex-col">
      {header}
      <main className={cn("flex-1", !hideBottomNav && "pb-[104px]")}>
        {children}
      </main>
      {hideBottomNav ? null : <BottomNavigation active={activeNav} />}
    </MobileCanvas>
  );
}
