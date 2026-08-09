"use client";

import { LoaderCircle, Search } from "lucide-react";
import type { FormEvent } from "react";

import { cn } from "@/lib/cn";

export interface SearchBarProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SearchBar({
  className,
  disabled = false,
  label,
  loading = false,
  onSubmit,
  onValueChange,
  placeholder = "输入你想了解的本地生活服务",
  submitLabel = "搜索",
  value,
}: SearchBarProps) {
  const unavailable = disabled || loading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();

    if (!query || unavailable) {
      return;
    }

    onSubmit(query);
  }

  return (
    <form
      role="search"
      aria-busy={loading}
      className={cn(
        "flex min-h-12 items-center gap-2 rounded-control border border-border bg-surface p-1.5 pl-3 shadow-card transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15",
        className,
      )}
      onSubmit={handleSubmit}
    >
      <label htmlFor="local-life-search" className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="size-5 shrink-0 text-text-subtle"
        strokeWidth={2}
      />
      <input
        id="local-life-search"
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={unavailable}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle disabled:cursor-not-allowed"
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button
        type="submit"
        aria-label={submitLabel}
        disabled={unavailable || value.trim().length === 0}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors outline-none hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Search aria-hidden="true" className="size-4" strokeWidth={2.25} />
        )}
      </button>
    </form>
  );
}
