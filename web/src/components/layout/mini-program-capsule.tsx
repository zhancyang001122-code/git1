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
      <div className="glass-control flex h-8 w-[84px] items-center rounded-full border text-text shadow-[0_2px_10px_rgb(57_72_110/8%)]">
        <button
          ref={triggerRef}
          type="button"
          aria-label="更多功能"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="ui-interactive inline-flex h-11 min-w-11 flex-1 items-center justify-center rounded-l-full border border-transparent outline-none"
        >
          <Ellipsis aria-hidden="true" className="size-5" />
        </button>
        <span aria-hidden="true" className="h-5 w-px bg-black/10" />
        <Link
          href="/"
          aria-label="返回首页"
          className="ui-interactive inline-flex h-11 min-w-11 flex-1 items-center justify-center rounded-r-full border border-transparent outline-none"
        >
          <House aria-hidden="true" className="size-[18px]" />
        </Link>
      </div>
      {open ? (
        <div
          role="menu"
          aria-label="更多功能"
          className="glass-panel absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-card p-1 shadow-floating"
        >
          <Link
            role="menuitem"
            href="/me"
            onClick={() => setOpen(false)}
            className="ui-interactive flex min-h-11 items-center rounded-control border border-transparent px-3 text-sm text-text outline-none hover:bg-brand-soft hover:text-brand"
          >
            帮助与说明
          </Link>
          <Link
            role="menuitem"
            href="/me/feedback"
            onClick={() => setOpen(false)}
            className="ui-interactive flex min-h-11 items-center rounded-control border border-transparent px-3 text-sm text-text outline-none hover:bg-brand-soft hover:text-brand"
          >
            反馈问题
          </Link>
        </div>
      ) : null}
    </div>
  );
}
