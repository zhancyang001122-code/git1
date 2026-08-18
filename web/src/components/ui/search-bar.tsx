"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useId, type FormEvent, type Ref } from "react";

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
  inputRef?: Ref<HTMLInputElement>;
  action?: string;
  queryName?: string;
}

export function SearchBar({
  action,
  className,
  disabled = false,
  inputRef,
  label,
  loading = false,
  onSubmit,
  onValueChange,
  placeholder = "输入你想了解的本地生活服务",
  queryName,
  submitLabel = "搜索",
  value,
}: SearchBarProps) {
  const inputId = useId();
  const unavailable = disabled || loading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const query = value.trim();
    event.preventDefault();

    if (!query || unavailable) {
      return;
    }
    onSubmit(query);
  }

  return (
    <form
      role="search"
      action={action}
      method={action ? "get" : undefined}
      aria-busy={loading}
      className={cn(
        "glass-control flex h-11 items-center gap-2 rounded-control border pl-3 shadow-card transition-colors motion-reduce:transition-none focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15",
        className,
      )}
      onSubmit={handleSubmit}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="size-5 shrink-0 text-text-subtle"
        strokeWidth={2}
      />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        name={queryName}
        value={value}
        placeholder={placeholder}
        disabled={unavailable}
        className="h-10 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle disabled:cursor-not-allowed"
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button
        type="submit"
        aria-label={submitLabel}
        disabled={unavailable || value.trim().length === 0}
        className="ui-interactive inline-flex size-11 shrink-0 items-center justify-center rounded-r-control border border-brand bg-brand text-white outline-none motion-reduce:transition-none hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
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
