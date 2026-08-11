"use client";

import { KeyRound, Mail, RotateCcw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/features/auth/safe-next";

interface ApiErrorPayload {
  error?: { message?: string; requestId?: string };
}

interface LoginExperienceProps {
  nextPath: string;
  navigate?: (path: string) => void;
  resendSeconds?: number;
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
  resendSeconds = 60,
}: LoginExperienceProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<{
    message: string;
    requestId?: string;
  } | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function sendOtp(isResend = false) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError({ message: "请输入邮箱地址" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok) {
        setError(await responseError(response, "验证码发送失败，请稍后重试"));
        return;
      }
      setEmail(normalizedEmail);
      setStep("otp");
      setCountdown(resendSeconds);
      setStatus(
        `${isResend ? "验证码已重新发送至" : "验证码已发送至"} ${normalizedEmail}`,
      );
    } catch {
      setError({ message: "网络连接失败，请检查网络后重试" });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(token)) {
      setError({ message: "请输入 6 位数字验证码" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token, next: nextPath }),
      });
      if (!response.ok) {
        setError(await responseError(response, "验证码校验失败，请重新输入"));
        return;
      }
      const payload = (await response.json()) as { next?: unknown };
      setStatus("登录成功，正在继续");
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
          {step === "email" ? (
            <Mail aria-hidden="true" className="size-5" />
          ) : (
            <KeyRound aria-hidden="true" className="size-5" />
          )}
        </span>
        <h1 className="mt-3 text-lg font-semibold text-text">
          {step === "email" ? "邮箱验证码登录" : "输入 6 位验证码"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {step === "email"
            ? "登录后才能读取和保存你的云端长期偏好，公开内容仍可匿名浏览。"
            : "验证码已发送到下方邮箱。验证码错误不会清空当前输入。"}
        </p>

        {step === "email" ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void sendOtp();
            }}
          >
            <label className="block text-sm font-medium text-text">
              邮箱
              <input
                aria-label="邮箱"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClass}
                placeholder="name@example.com"
              />
            </label>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "正在发送" : "发送验证码"}
            </Button>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={verifyOtp}>
            <div className="flex items-center justify-between gap-3 rounded-control bg-page px-3 py-2">
              <span className="min-w-0 truncate text-sm text-text">
                {email}
              </span>
              <button
                type="button"
                className="min-h-11 shrink-0 text-sm font-medium text-brand"
                onClick={() => {
                  setStep("email");
                  setToken("");
                  setError(null);
                  setStatus("");
                }}
              >
                修改邮箱
              </button>
            </div>
            <label className="block text-sm font-medium text-text">
              6 位验证码
              <input
                aria-label="6 位验证码"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={token}
                onChange={(event) =>
                  setToken(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={`${fieldClass} text-center text-2xl tracking-[0.35em]`}
              />
            </label>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "正在验证" : "登录并继续"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={busy || countdown > 0}
              aria-label={
                countdown > 0 ? `${countdown} 秒后可重新发送` : "重新发送验证码"
              }
              onClick={() => void sendOtp(true)}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              {countdown > 0 ? `${countdown} 秒后可重新发送` : "重新发送验证码"}
            </Button>
          </form>
        )}

        {status ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-sm text-success"
          >
            {status}
          </p>
        ) : null}
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
      <p className="px-2 text-xs leading-5 text-text-subtle">
        登录只建立当前浏览器会话，不会自动开启长期记忆，也不会自动保存聊天内容。
      </p>
    </div>
  );
}
