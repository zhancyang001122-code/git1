"use client";

import { Ellipsis, House } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function MiniProgramCapsule() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeFromOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative justify-self-end">
      <div className="flex h-8 w-[84px] items-center rounded-full border border-black/15 bg-white/90 text-text shadow-[0_1px_2px_rgb(0_0_0/4%)]">
        <button
          ref={triggerRef}
          type="button"
          aria-label="更多功能"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-11 min-w-11 flex-1 items-center justify-center rounded-l-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
        >
          <Ellipsis aria-hidden="true" className="size-5" />
        </button>
        <span aria-hidden="true" className="h-5 w-px bg-black/10" />
        <Link
          href="/"
          aria-label="返回首页"
          className="inline-flex h-11 min-w-11 flex-1 items-center justify-center rounded-r-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
        >
          <House aria-hidden="true" className="size-[18px]" />
        </Link>
      </div>
      {open ? (
        <div
          role="menu"
          aria-label="更多功能"
          className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-card border border-border bg-surface p-1 shadow-floating"
        >
          <Link
            role="menuitem"
            href="/me"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-control px-3 text-sm text-text outline-none hover:bg-page focus-visible:bg-brand-soft focus-visible:text-brand"
          >
            帮助与说明
          </Link>
          <Link
            role="menuitem"
            href="/me/feedback"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-control px-3 text-sm text-text outline-none hover:bg-page focus-visible:bg-brand-soft focus-visible:text-brand"
          >
            反馈问题
          </Link>
        </div>
      ) : null}
    </div>
  );
}
