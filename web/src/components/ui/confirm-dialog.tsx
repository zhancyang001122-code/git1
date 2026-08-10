"use client";

import { useCallback, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useModalFocus } from "@/components/ui/modal-focus";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm(): void;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "取消",
  onConfirm,
  danger = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useModalFocus(open, close, dialogRef);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] mx-auto flex w-full max-w-[430px] items-center justify-center px-8">
      <button
        type="button"
        aria-label={`关闭${title}`}
        onClick={close}
        className="absolute inset-0 size-full bg-black/40"
      />
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative w-full rounded-feature bg-surface p-5 shadow-floating outline-none"
      >
        <h2
          id={titleId}
          className="text-center text-lg font-semibold text-text"
        >
          {title}
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-center text-sm leading-6 text-text-muted"
        >
          {description}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={close}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
