import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-brand bg-brand text-white shadow-sm hover:bg-brand-strong active:bg-brand-strong",
  secondary:
    "glass-control border text-text hover:bg-brand-soft/70 active:bg-brand-soft",
  ghost:
    "border border-transparent bg-transparent text-text-muted hover:bg-brand-soft/70 hover:text-brand",
  danger:
    "border border-danger bg-danger text-white hover:brightness-95 active:brightness-90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, type = "button", variant = "primary", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "ui-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold outline-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
