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
      <a
        href="#main-content"
        className="glass-control ui-interactive sr-only z-[60] rounded-control border px-3 py-2 text-sm text-brand focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        跳到主要内容
      </a>
      {header}
      <main
        id="main-content"
        className={cn(
          "flex-1",
          !hideBottomNav && "pb-[calc(72px+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </main>
      {hideBottomNav ? null : <BottomNavigation active={activeNav} />}
    </MobileCanvas>
  );
}
