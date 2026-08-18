import Link from "next/link";
import {
  Bot,
  Compass,
  House,
  MessageCircle,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";

export type MainNavKey = "home" | "discover" | "xiaozhi" | "messages" | "me";

interface NavItem {
  key: MainNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
}

const navigationItems: readonly NavItem[] = [
  { key: "home", label: "首页", href: "/", icon: House },
  { key: "discover", label: "推荐", href: "/discover", icon: Compass },
  { key: "xiaozhi", label: "小智", href: "/xiaozhi", icon: Bot },
  {
    key: "messages",
    label: "消息",
    href: "/messages",
    icon: MessageCircle,
  },
  { key: "me", label: "我的", href: "/me", icon: UserRound },
];

export interface BottomNavigationProps {
  active: MainNavKey;
}

export function BottomNavigation({ active }: BottomNavigationProps) {
  return (
    <nav
      aria-label="主导航"
      className="glass-navigation fixed bottom-0 left-1/2 z-50 grid h-[calc(56px+env(safe-area-inset-bottom))] w-full max-w-[430px] -translate-x-1/2 grid-cols-5 border-t px-1 pb-[env(safe-area-inset-bottom)]"
    >
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "ui-interactive relative flex h-14 min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-control border border-transparent text-xs font-medium text-text-muted outline-none motion-reduce:transition-none",
              isActive && "border-brand/15 bg-brand-soft/70 text-brand",
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center"
            >
              <Icon className="size-[22px]" strokeWidth={isActive ? 2.3 : 2} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
