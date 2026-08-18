"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";

export interface ToastProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  message: string;
  duration?: number;
  tone?: "success" | "error" | "neutral";
}

export function Toast({
  open,
  onOpenChange,
  message,
  duration = 1_800,
  tone = "success",
}: ToastProps) {
  useEffect(() => {
    if (!open || duration <= 0) return;
    const timer = window.setTimeout(() => onOpenChange(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, onOpenChange, open]);

  if (!open) return null;
  const Icon =
    tone === "error" ? CircleAlert : tone === "neutral" ? Info : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-label={message}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className="fixed left-1/2 top-[calc(64px+env(safe-area-inset-top))] z-[90] flex min-h-11 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 items-center gap-2 rounded-control bg-black/80 px-3 py-2 text-sm text-white shadow-floating"
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-5 shrink-0",
          tone === "success" && "text-success",
          tone === "error" && "text-danger",
        )}
      />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        aria-label="关闭提示"
        onClick={() => onOpenChange(false)}
        className="ui-interactive inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-transparent outline-none focus-visible:ring-white"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
