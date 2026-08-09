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
  prominent?: boolean;
}

const navigationItems: readonly NavItem[] = [
  { key: "home", label: "首页", href: "/", icon: House },
  { key: "discover", label: "推荐", href: "/discover", icon: Compass },
  {
    key: "xiaozhi",
    label: "小智",
    href: "/xiaozhi",
    icon: Bot,
    prominent: true,
  },
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
      className="fixed bottom-0 left-1/2 z-50 grid h-[calc(76px+env(safe-area-inset-bottom))] w-full max-w-[430px] -translate-x-1/2 grid-cols-5 border-t border-border bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-xl"
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
              "relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium text-text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
              isActive && "text-brand",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                item.prominent &&
                  "-mt-8 size-16 border-4 border-white bg-gradient-to-br from-brand to-accent text-white shadow-floating",
              )}
            >
              <Icon className={cn("size-6", item.prominent && "size-8")} />
            </span>
            <span className={cn(item.prominent && "-mt-1")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
