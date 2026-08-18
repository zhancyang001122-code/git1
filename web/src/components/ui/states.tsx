"use client";

import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  className,
  message = "正在加载",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "glass-panel flex min-h-32 flex-col items-center justify-center gap-3 rounded-card p-6 text-center text-sm text-text-muted",
        className,
      )}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-6 animate-spin text-brand"
      />
      <span>{message}</span>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  action,
  className,
  message,
  title,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "glass-panel flex min-h-44 flex-col items-center justify-center rounded-card border-dashed px-6 py-8 text-center",
        className,
      )}
    >
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-surface-tint text-text-muted">
        <Inbox aria-hidden="true" className="size-5" />
      </span>
      <h3 className="font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-text-muted">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export interface ErrorStateProps {
  title: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  className,
  message,
  onRetry,
  requestId,
  title,
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className={cn(
        "glass-panel rounded-card border-danger/20 p-5 text-center",
        className,
      )}
    >
      <span className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <h3 className="font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-text-muted">{message}</p>
      {requestId ? (
        <p className="mt-2 font-mono text-xs text-text-subtle">
          请求编号：{requestId}
        </p>
      ) : null}
      {onRetry ? (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </section>
  );
}
