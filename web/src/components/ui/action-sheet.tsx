"use client";

import { X } from "lucide-react";
import { useCallback, useId, useRef, type ReactNode } from "react";

import { useModalFocus } from "@/components/ui/modal-focus";

export interface ActionSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: ActionSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useModalFocus(open, close, dialogRef);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] mx-auto w-full max-w-[430px]">
      <button
        type="button"
        aria-label={`关闭${title}`}
        onClick={close}
        className="absolute inset-0 size-full bg-black/40"
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-feature bg-surface pb-[env(safe-area-inset-bottom)] shadow-floating outline-none"
      >
        <div className="sticky top-0 flex min-h-14 items-center justify-between border-b border-border bg-surface px-4">
          <div className="min-w-0 pr-3">
            <h2
              id={titleId}
              className="truncate text-lg font-semibold text-text"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-xs text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={`关闭${title}`}
            onClick={close}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted outline-none hover:bg-page focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}
