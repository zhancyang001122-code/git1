import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { children, className, label, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          "ui-interactive inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-transparent text-text-muted outline-none hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
