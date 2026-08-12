import Link from "next/link";

import type {
  ApiRouteLogEntry,
  ApiRouteLogFilters,
  OperationalAlert,
  ToolRunLogEntry,
  ToolRunLogFilters,
  ToolRunLogStatus,
} from "@/features/ai-ops/dashboard";

type MonitoringStatus = "ready" | "demo" | "unavailable";

const toolStatusLabels: Record<ToolRunLogStatus, string> = {
  succeeded: "成功",
  failed: "失败",
  timed_out: "超时",
};

function unavailableMessage(status: MonitoringStatus, resource: string) {
  return status === "demo"
    ? `Demo 不读取集中式${resource}，避免伪造生产运行状态。`
    : `${resource}暂时不可用；请检查数据库迁移和服务端配置。`;
}

export function OperationalAlerts({
  alerts,
  status,
}: {
  alerts: readonly OperationalAlert[] | null;
  status: MonitoringStatus;
}) {
  if (status !== "ready" || !alerts) {
    return (
      <section
        aria-label="AI Ops 站内告警"
        className="mx-4 mt-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 className="text-base font-semibold text-text">AI Ops 站内告警</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {unavailableMessage(status, "告警状态")}
        </p>
      </section>
    );
  }

  const activeCount = alerts.filter((alert) => alert.state === "alert").length;
  return (
    <section
      aria-label="AI Ops 站内告警"
      className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-brand">Supabase 集中计算</p>
          <h2 className="mt-1 text-lg font-semibold text-text">
            AI Ops 站内告警
          </h2>
        </div>
        <span
          className={`rounded-control px-2 py-1 text-xs ${
            activeCount > 0
              ? "bg-danger/10 text-danger"
              : "bg-success/10 text-success"
          }`}
        >
          {activeCount > 0 ? `${activeCount} 个站内告警` : "当前无告警"}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {alerts.map((alert) => {
          const stateLabel =
            alert.state === "alert"
              ? "告警中"
              : alert.state === "ok"
                ? "正常"
                : "样本不足";
          const stateClass =
            alert.state === "alert"
              ? alert.severity === "critical"
                ? "text-danger"
                : "text-warning"
              : alert.state === "ok"
                ? "text-success"
                : "text-text-subtle";
          const unit = alert.key === "knowledge_index_backlog" ? " 个" : "%";
          return (
            <li key={alert.key} className="rounded-card bg-surface-tint p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-text">{alert.title}</h3>
                <span className={`text-xs font-medium ${stateClass}`}>
                  {stateLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                当前 {alert.metricValue}
                {unit} · 阈值 {alert.thresholdValue}
                {unit} · 样本 {alert.sampleCount}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-subtle">
                {alert.detail}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-5 text-text-subtle">
        每次打开页面按集中式真实记录计算；这是站内阈值状态，不包含外部通知、值班升级或事故认领。
      </p>
    </section>
  );
}

export function ToolRunLog({
  entries,
  filters,
  status,
}: {
  entries: readonly ToolRunLogEntry[] | null;
  filters: ToolRunLogFilters;
  status: MonitoringStatus;
}) {
  if (status !== "ready" || !entries) {
    return (
      <section
        aria-label="跨实例工具审计"
        className="mx-4 mt-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 className="text-base font-semibold text-text">跨实例工具审计</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {unavailableMessage(status, "工具审计")}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="跨实例工具审计"
      className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card"
    >
      <h2 className="text-lg font-semibold text-text">跨实例工具审计</h2>
      <p className="mt-1 text-xs leading-5 text-text-subtle">
        从 Supabase 查询所有 Vercel
        实例写入的安全元数据；不返回工具输入、输出正文或完整 Prompt。
      </p>

      <form
        aria-label="工具审计筛选"
        action="/knowledge-admin"
        method="get"
        className="mt-4 grid gap-3 rounded-card bg-surface-tint p-3"
      >
        <label className="text-xs text-text-muted">
          状态
          <select
            name="toolStatus"
            defaultValue={filters.status ?? ""}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text"
          >
            <option value="">全部终态</option>
            <option value="succeeded">成功</option>
            <option value="failed">失败</option>
            <option value="timed_out">超时</option>
          </select>
        </label>
        <label className="text-xs text-text-muted">
          工具名（精确匹配）
          <input
            name="toolName"
            defaultValue={filters.toolName ?? ""}
            placeholder="例如 search_knowledge"
            pattern="[a-z][a-z0-9_]{1,79}"
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-control bg-brand px-3 text-sm font-semibold text-white"
          >
            查询
          </button>
          <Link
            href="/knowledge-admin"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-border bg-surface px-3 text-sm text-text-muted"
          >
            清除筛选
          </Link>
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">当前筛选条件没有记录。</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-card bg-surface-tint p-3">
              <div className="flex items-center justify-between gap-3">
                <code className="text-xs font-medium text-text">
                  {entry.toolName}
                </code>
                <span
                  className={`text-xs font-medium ${
                    entry.status === "succeeded"
                      ? "text-success"
                      : entry.status === "timed_out"
                        ? "text-warning"
                        : "text-danger"
                  }`}
                >
                  {toolStatusLabels[entry.status]}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                来源 {entry.sourceLabel ?? "未标注"} · 耗时{" "}
                {entry.durationMs ?? "—"}
                {entry.durationMs === null ? "" : "ms"}
              </p>
              {entry.errorCode ? (
                <p className="text-xs leading-5 text-danger">
                  错误码 {entry.errorCode}
                </p>
              ) : null}
              <p className="break-all text-xs leading-5 text-text-subtle">
                requestId {entry.requestId}
              </p>
              <time
                dateTime={entry.createdAt}
                className="text-xs leading-5 text-text-subtle"
              >
                {new Date(entry.createdAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  hour12: false,
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ApiRouteLog({
  entries,
  filters,
  status,
}: {
  entries: readonly ApiRouteLogEntry[] | null;
  filters: ApiRouteLogFilters;
  status: MonitoringStatus;
}) {
  if (status !== "ready" || !entries) {
    return (
      <section
        aria-label="跨实例 API 日志"
        className="mx-4 mt-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 className="text-base font-semibold text-text">跨实例 API 日志</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {unavailableMessage(status, "API 日志")}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="跨实例 API 日志"
      className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card"
    >
      <h2 className="text-lg font-semibold text-text">跨实例 API 日志</h2>
      <p className="mt-1 text-xs leading-5 text-text-subtle">
        汇总所有 Vercel
        实例的路由、状态和耗时；不记录查询参数、正文、Cookie、Authorization、IP
        或响应正文。
      </p>

      <form
        aria-label="API 日志筛选"
        action="/knowledge-admin"
        method="get"
        className="mt-4 grid gap-3 rounded-card bg-surface-tint p-3"
      >
        <label className="text-xs text-text-muted">
          方法
          <select
            name="routeMethod"
            defaultValue={filters.method ?? ""}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text"
          >
            <option value="">全部方法</option>
            {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map(
              (method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="text-xs text-text-muted">
          状态
          <select
            name="routeStatus"
            defaultValue={filters.statusClass ?? ""}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text"
          >
            <option value="">全部状态</option>
            <option value="2">2xx 成功</option>
            <option value="3">3xx 重定向</option>
            <option value="4">4xx 客户端错误</option>
            <option value="5">5xx 服务端错误</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-control bg-brand px-3 text-sm font-semibold text-white"
          >
            查询
          </button>
          <Link
            href="/knowledge-admin"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-border bg-surface px-3 text-sm text-text-muted"
          >
            清除筛选
          </Link>
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">当前筛选条件没有记录。</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-card bg-surface-tint p-3">
              <div className="flex items-center justify-between gap-3">
                <code className="break-all text-xs font-medium text-text">
                  {entry.routeKey}
                </code>
                <span
                  className={`text-xs font-medium ${
                    entry.statusCode >= 500
                      ? "text-danger"
                      : entry.statusCode >= 400
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  {entry.method} {entry.statusCode}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                耗时 {entry.durationMs}ms
              </p>
              {entry.errorCode ? (
                <p className="text-xs leading-5 text-danger">
                  错误码 {entry.errorCode}
                </p>
              ) : null}
              <p className="break-all text-xs leading-5 text-text-subtle">
                requestId {entry.requestId}
              </p>
              <time
                dateTime={entry.createdAt}
                className="text-xs leading-5 text-text-subtle"
              >
                {new Date(entry.createdAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  hour12: false,
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
