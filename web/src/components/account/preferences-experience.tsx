"use client";

import { Cloud, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Toast } from "@/components/ui/toast";
import type { PreferencesResponse } from "@/features/preferences/schemas";

interface PreferencesExperienceProps {
  onAuthRequired?: () => void;
}

interface FormValues {
  budget: string;
  areas: string;
  dietary: string;
  transport: string;
  family: string;
}

interface RequestError {
  message: string;
  requestId?: string;
}

const emptyForm: FormValues = {
  budget: "",
  areas: "",
  dietary: "",
  transport: "",
  family: "",
};

const fieldClass =
  "mt-2 min-h-11 w-full rounded-control border border-border bg-page px-3 text-sm text-text outline-none focus:ring-2 focus:ring-brand";

function redirectToLogin() {
  window.location.assign(
    new URL(
      "/login?next=%2Fme%2Fpreferences",
      window.location.origin,
    ).toString(),
  );
}

function listFromInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function formFromResponse(response: PreferencesResponse): FormValues {
  if (!response.allowLongTermMemory) return emptyForm;
  return {
    budget:
      response.preferences.maxHousingBudget === null
        ? ""
        : String(response.preferences.maxHousingBudget),
    areas: response.preferences.preferredAreas.join(","),
    dietary: response.preferences.dietaryRestrictions.join(","),
    transport: response.preferences.transportModes.join(","),
    family: response.preferences.familyProfile.join(","),
  };
}

async function readError(
  response: Response,
  fallback: string,
): Promise<RequestError> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; requestId?: string };
    };
    return {
      message: payload.error?.message ?? fallback,
      requestId: payload.error?.requestId,
    };
  } catch {
    return { message: fallback };
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PreferencesExperience({
  onAuthRequired = redirectToLogin,
}: PreferencesExperienceProps) {
  const [state, setState] = useState<PreferencesResponse | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [confirm, setConfirm] = useState<"save" | "delete" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/preferences", {
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        onAuthRequired();
        return;
      }
      if (!response.ok) {
        setError(await readError(response, "云端偏好读取失败，请稍后重试"));
        return;
      }
      const payload = (await response.json()) as PreferencesResponse;
      setState(payload);
      setForm(formFromResponse(payload));
    } catch {
      setError({ message: "网络连接失败，请检查网络后重试" });
    } finally {
      setLoading(false);
    }
  }, [onAuthRequired]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const saveSummary = [
    `住房月预算上限：${form.budget ? `¥${Number(form.budget).toLocaleString("zh-CN")}` : "未设置"}`,
    `常用区域：${form.areas || "未设置"}`,
    `饮食限制：${form.dietary || "未设置"}`,
    `交通方式：${form.transport || "未设置"}`,
    `家庭情况：${form.family || "未设置"}`,
  ].join("；");

  async function patchPreferences(body: object) {
    const response = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) {
      onAuthRequired();
      return null;
    }
    if (!response.ok) {
      setError(await readError(response, "云端偏好保存失败，请稍后重试"));
      return null;
    }
    return (await response.json()) as PreferencesResponse;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = await patchPreferences({
        allowLongTermMemory: true,
        preferences: {
          maxHousingBudget: form.budget === "" ? null : Number(form.budget),
          preferredAreas: listFromInput(form.areas),
          dietaryRestrictions: listFromInput(form.dietary),
          transportModes: listFromInput(form.transport),
          familyProfile: listFromInput(form.family),
        },
      });
      if (!payload) return;
      setState(payload);
      setForm(formFromResponse(payload));
      setToast("云端偏好已保存");
    } catch {
      setError({ message: "网络连接失败，请检查网络后重试" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const payload = await patchPreferences({ allowLongTermMemory: false });
      if (!payload) return;
      setState(payload);
      setForm(emptyForm);
      setToast("长期偏好已从云端删除");
    } catch {
      setError({ message: "网络连接失败，请检查网络后重试" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-5">
        <LoadingState message="正在读取云端偏好" />
      </div>
    );
  }

  if (error && state === null) {
    return (
      <div className="px-4 py-5">
        <ErrorState
          title="暂时无法读取云端偏好"
          message={error.message}
          requestId={error.requestId}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const enabled = state?.allowLongTermMemory === true;
  return (
    <div className="space-y-4 px-4 py-5">
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            {enabled ? (
              <ShieldCheck aria-hidden="true" className="size-5" />
            ) : (
              <Cloud aria-hidden="true" className="size-5" />
            )}
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">
              {enabled ? "长期记忆已启用" : "长期记忆尚未启用"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              保存到 Supabase
              云端，仅用于小智个性化；关闭后会删除已保存的整行偏好。
            </p>
            {enabled ? (
              <p className="mt-2 text-xs leading-5 text-text-subtle">
                授权于 {formatTime(state.consentedAt)} · 最近更新{" "}
                {formatTime(state.updatedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <form
        className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          setConfirm("save");
        }}
      >
        <label className="block text-sm font-medium text-text">
          住房月预算上限
          <input
            aria-label="住房月预算上限"
            type="number"
            min="0"
            max="200000"
            step="1"
            value={form.budget}
            onChange={(event) => update("budget", event.target.value)}
            className={fieldClass}
            placeholder="例如 4200"
          />
        </label>
        <label className="block text-sm font-medium text-text">
          常用区域
          <input
            aria-label="常用区域"
            value={form.areas}
            onChange={(event) => update("areas", event.target.value)}
            className={fieldClass}
            placeholder="多个值用逗号分隔"
          />
        </label>
        <label className="block text-sm font-medium text-text">
          饮食限制
          <input
            aria-label="饮食限制"
            value={form.dietary}
            onChange={(event) => update("dietary", event.target.value)}
            className={fieldClass}
            placeholder="例如 不吃辣,花生过敏"
          />
        </label>
        <label className="block text-sm font-medium text-text">
          交通方式
          <input
            aria-label="交通方式"
            value={form.transport}
            onChange={(event) => update("transport", event.target.value)}
            className={fieldClass}
            placeholder="例如 地铁,步行"
          />
        </label>
        <label className="block text-sm font-medium text-text">
          家庭情况
          <input
            aria-label="家庭情况"
            value={form.family}
            onChange={(event) => update("family", event.target.value)}
            className={fieldClass}
            placeholder="例如 独居"
          />
        </label>
        <Button type="submit" className="w-full" disabled={busy}>
          {enabled ? "更新云端偏好" : "同意并保存到云端"}
        </Button>
      </form>

      {error ? (
        <div
          role="alert"
          className="rounded-control border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
        >
          <p>{error.message}</p>
          {error.requestId ? (
            <p className="mt-1 font-mono text-xs">
              请求编号：{error.requestId}
            </p>
          ) : null}
        </div>
      ) : null}

      {enabled ? (
        <Button
          variant="ghost"
          className="w-full text-danger"
          disabled={busy}
          onClick={() => setConfirm("delete")}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          关闭长期记忆并删除偏好
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm === "save"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={enabled ? "更新云端长期偏好？" : "授权保存长期偏好？"}
        description={saveSummary}
        confirmLabel={enabled ? "确认更新" : "确认保存"}
        onConfirm={() => void save()}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="关闭长期记忆并删除偏好？"
        description="这会删除 Supabase 中当前账号保存的整行长期偏好，退出登录本身不会执行此删除。"
        confirmLabel="确认删除"
        danger
        onConfirm={() => void remove()}
      />
      <Toast
        open={Boolean(toast)}
        onOpenChange={(open) => {
          if (!open) setToast(null);
        }}
        message={toast ?? ""}
        duration={0}
      />
    </div>
  );
}
