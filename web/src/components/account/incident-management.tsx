"use client";

import { CheckCircle2, ClipboardCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import type {
  IncidentRecord,
  IncidentStatus,
} from "@/features/ai-ops/incidents";

type MonitoringStatus = "ready" | "demo" | "unavailable";

const statusLabels: Record<IncidentStatus, string> = {
  open: "待认领",
  acknowledged: "处理中",
  resolved: "已解决",
};

export function IncidentManagement({
  incidents,
  status,
}: {
  incidents: readonly IncidentRecord[] | null;
  status: MonitoringStatus;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  async function transition(
    incident: IncidentRecord,
    action: "acknowledge" | "resolve",
  ) {
    setBusyId(incident.id);
    try {
      const response = await fetch("/api/knowledge/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          incidentId: incident.id,
          action,
          note: notes[incident.id]?.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "事故操作失败");
      }
      setNotice({
        message: action === "acknowledge" ? "事故已认领。" : "事故已解决。",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "事故操作失败",
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (status !== "ready" || !incidents) {
    return (
      <section
        aria-label="事故认领"
        className="mx-4 mt-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 className="text-base font-semibold text-text">事故认领</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {status === "demo"
            ? "Demo 不创建持久化事故，避免把内存状态伪装成真实响应流程。"
            : "事故管理暂时不可用；请检查数据库迁移和服务端配置。"}
        </p>
      </section>
    );
  }

  const activeCount = incidents.filter(
    (incident) => incident.status !== "resolved",
  ).length;
  return (
    <section
      aria-label="事故认领"
      className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-brand">持久化响应闭环</p>
          <h2 className="mt-1 text-lg font-semibold text-text">事故认领</h2>
        </div>
        <span
          className={`rounded-control px-2 py-1 text-xs ${
            activeCount > 0
              ? "bg-danger/10 text-danger"
              : "bg-success/10 text-success"
          }`}
        >
          {activeCount > 0 ? `${activeCount} 个处理中` : "无活跃事故"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-text-subtle">
        监控每天自动同步；认领、解决和自动恢复都会写入不可变审计事件。这里没有外部通知或真实值班排班。
      </p>

      {incidents.length === 0 ? (
        <p className="mt-4 rounded-card bg-success/10 p-3 text-sm text-success">
          当前没有事故记录。
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {incidents.map((incident) => {
            const busy = busyId === incident.id;
            return (
              <li
                key={incident.id}
                className="rounded-card bg-surface-tint p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-text">
                      {incident.title}
                    </h3>
                    <p className="mt-1 text-xs text-text-muted">
                      当前 {incident.metricValue} · 阈值{" "}
                      {incident.thresholdValue} · 样本 {incident.sampleCount}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      incident.status === "resolved"
                        ? "text-success"
                        : incident.severity === "critical"
                          ? "text-danger"
                          : "text-warning"
                    }`}
                  >
                    {statusLabels[incident.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-text-subtle">
                  {incident.detail}
                </p>
                <p className="mt-1 text-xs leading-5 text-text-subtle">
                  审计事件 {incident.eventCount} 条
                  {incident.acknowledgedBy
                    ? ` · 认领人 ${incident.acknowledgedBy}`
                    : ""}
                </p>
                {incident.resolutionNote ? (
                  <p className="mt-1 text-xs leading-5 text-success">
                    处理说明：{incident.resolutionNote}
                  </p>
                ) : null}

                {incident.status !== "resolved" ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs text-text-muted">
                      {incident.status === "open"
                        ? "排查备注（可选）"
                        : "解决说明（必填）"}
                      <textarea
                        aria-label={`${incident.title}处理说明`}
                        value={notes[incident.id] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [incident.id]: event.target.value,
                          }))
                        }
                        maxLength={500}
                        className="mt-1 min-h-20 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm leading-5 text-text outline-none focus:ring-2 focus:ring-brand"
                      />
                    </label>
                    {incident.status === "open" ? (
                      <Button
                        className="w-full"
                        disabled={busy}
                        onClick={() => void transition(incident, "acknowledge")}
                      >
                        {busy ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <ClipboardCheck className="size-4" />
                        )}
                        认领事故
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={busy || !notes[incident.id]?.trim()}
                        onClick={() => void transition(incident, "resolve")}
                      >
                        {busy ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        标记已解决
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice?.message ?? ""}
        duration={0}
        tone={notice?.tone ?? "success"}
      />
    </section>
  );
}
