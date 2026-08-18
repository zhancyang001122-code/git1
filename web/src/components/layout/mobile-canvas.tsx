import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface MobileCanvasProps {
  children: ReactNode;
  className?: string;
}

export function MobileCanvas({ children, className }: MobileCanvasProps) {
  return (
    <div
      className={cn(
        "mobile-canvas-shell relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-clip bg-page shadow-canvas",
        className,
      )}
    >
      {children}
    </div>
  );
}
