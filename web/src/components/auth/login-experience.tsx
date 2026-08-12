"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/features/auth/safe-next";
import { DEMO_LOGIN_CODE } from "@/features/auth/schemas";

interface ApiErrorPayload {
  error?: { message?: string; requestId?: string };
}

interface LoginExperienceProps {
  nextPath: string;
  navigate?: (path: string) => void;
}

const fieldClass =
  "mt-2 min-h-11 w-full rounded-control border border-border bg-page px-3 text-sm text-text outline-none focus:ring-2 focus:ring-brand";

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return {
      message: payload.error?.message ?? fallback,
      requestId: payload.error?.requestId,
    };
  } catch {
    return { message: fallback, requestId: undefined };
  }
}

export function LoginExperience({
  navigate = (path) => window.location.assign(path),
  nextPath,
}: LoginExperienceProps) {
  const [code, setCode] = useState(DEMO_LOGIN_CODE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    requestId?: string;
  } | null>(null);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError({ message: "请输入 6 位演示码" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, next: nextPath }),
      });
      if (!response.ok) {
        setError(await responseError(response, "演示登录失败，请稍后重试"));
        return;
      }
      const payload = (await response.json()) as { next?: unknown };
      navigate(safeNextPath(payload.next));
    } catch {
      setError({ message: "网络连接失败，请检查网络后重试" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-5">
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
          <KeyRound aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-text">固定演示码登录</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          这是作品集演示账号，不会发送短信或邮件。公开演示码已预填，登录后可体验真实
          Supabase 会话、RLS 和云端偏好。
        </p>

        <form className="mt-5 space-y-4" onSubmit={signIn}>
          <label className="block text-sm font-medium text-text">
            6 位演示码
            <input
              aria-label="6 位演示码"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={`${fieldClass} text-center text-2xl tracking-[0.35em]`}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "正在进入演示账号" : "进入演示账号"}
          </Button>
        </form>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-control border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            <p>{error.message}</p>
            {error.requestId ? (
              <p className="mt-1 font-mono text-xs">
                请求编号：{error.requestId}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-brand"
          />
          <p className="text-xs leading-5 text-text-subtle">
            演示账号由所有体验者共享，不要填写真实隐私。退出前可在“云端长期偏好”关闭长期记忆并删除演示数据。
          </p>
        </div>
      </section>
    </div>
  );
}
