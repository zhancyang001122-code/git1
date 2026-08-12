import {
  AIOpsOverview,
  RAGOpsTrend,
} from "@/components/account/ai-ops-overview";
import {
  OperationalAlerts,
  ToolRunLog,
} from "@/components/account/ai-ops-monitoring";
import { KnowledgeAdminList } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
import {
  loadAIOpsDashboard,
  loadAIModelUsage,
  loadOperationalAlerts,
  loadRAGOpsTrend,
  loadToolRunLogs,
  toolRunLogFiltersFromSearchParams,
  type AIOpsDashboard,
  type OperationalAlert,
  type RAGOpsTrendPoint,
  type ToolRunLogEntry,
} from "@/features/ai-ops/dashboard";
import {
  estimateAIModelCost,
  pricingConfigurationFromEnvironment,
  type AIModelCostEstimate,
} from "@/features/ai-ops/pricing";
import { requireKnowledgeAdminPage } from "@/features/knowledge-ops/page-auth";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    toolStatus?: string | string[];
    toolName?: string | string[];
  }>;
}) {
  await requireKnowledgeAdminPage();
  const toolRunFilters = toolRunLogFiltersFromSearchParams(await searchParams);
  const runtime = await createKnowledgeOpsRuntime();
  const candidates = await runtime.service.listCandidates();
  let dashboard: AIOpsDashboard | null = null;
  let trend: readonly RAGOpsTrendPoint[] | null = null;
  let costEstimate: AIModelCostEstimate | null = null;
  let alerts: readonly OperationalAlert[] | null = null;
  let toolRunLogs: readonly ToolRunLogEntry[] | null = null;
  let dashboardStatus: "ready" | "demo" | "unavailable" =
    runtime.mode === "demo" ? "demo" : "unavailable";
  let trendStatus: "ready" | "demo" | "unavailable" = dashboardStatus;
  let alertsStatus: "ready" | "demo" | "unavailable" = dashboardStatus;
  let toolRunLogsStatus: "ready" | "demo" | "unavailable" = dashboardStatus;
  if (runtime.mode === "live") {
    const client = createAdminSupabaseClient();
    const [
      dashboardResult,
      trendResult,
      usageResult,
      alertsResult,
      logsResult,
    ] = await Promise.allSettled([
      loadAIOpsDashboard(client),
      loadRAGOpsTrend(client),
      loadAIModelUsage(client),
      loadOperationalAlerts(client),
      loadToolRunLogs(client, toolRunFilters),
    ]);
    if (dashboardResult.status === "fulfilled") {
      dashboard = dashboardResult.value;
      dashboardStatus = "ready";
    } else {
      logger.warn("ai_ops.dashboard_unavailable", {
        requestId: crypto.randomUUID(),
        errorCode:
          dashboardResult.reason instanceof AppError
            ? dashboardResult.reason.code
            : "UNKNOWN_DASHBOARD_ERROR",
      });
    }
    if (trendResult.status === "fulfilled") {
      trend = trendResult.value;
      trendStatus = "ready";
    } else {
      logger.warn("rag_ops.trend_unavailable", {
        requestId: crypto.randomUUID(),
        errorCode:
          trendResult.reason instanceof AppError
            ? trendResult.reason.code
            : "UNKNOWN_TREND_ERROR",
      });
    }
    if (usageResult.status === "fulfilled") {
      const pricing = pricingConfigurationFromEnvironment(process.env);
      if (pricing) {
        costEstimate = estimateAIModelCost(usageResult.value, pricing);
      }
    } else {
      logger.warn("ai_ops.model_usage_unavailable", {
        requestId: crypto.randomUUID(),
        errorCode:
          usageResult.reason instanceof AppError
            ? usageResult.reason.code
            : "UNKNOWN_MODEL_USAGE_ERROR",
      });
    }
    if (alertsResult.status === "fulfilled") {
      alerts = alertsResult.value;
      alertsStatus = "ready";
    } else {
      logger.warn("ai_ops.alerts_unavailable", {
        requestId: crypto.randomUUID(),
        errorCode:
          alertsResult.reason instanceof AppError
            ? alertsResult.reason.code
            : "UNKNOWN_ALERT_ERROR",
      });
    }
    if (logsResult.status === "fulfilled") {
      toolRunLogs = logsResult.value;
      toolRunLogsStatus = "ready";
    } else {
      logger.warn("ai_ops.tool_logs_unavailable", {
        requestId: crypto.randomUUID(),
        errorCode:
          logsResult.reason instanceof AppError
            ? logsResult.reason.code
            : "UNKNOWN_TOOL_LOG_ERROR",
      });
    }
  }
  return (
    <DetailShell title="知识运营演示" backHref="/me">
      <div className="flex justify-end px-4 pt-4">
        <form action="/api/knowledge/admin-session/logout" method="post">
          <button
            type="submit"
            className="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-medium text-text-muted"
          >
            退出管理登录
          </button>
        </form>
      </div>
      <AIOpsOverview
        dashboard={dashboard}
        status={dashboardStatus}
        costEstimate={costEstimate}
      />
      <OperationalAlerts alerts={alerts} status={alertsStatus} />
      <RAGOpsTrend trend={trend} status={trendStatus} />
      <ToolRunLog
        entries={toolRunLogs}
        filters={toolRunFilters}
        status={toolRunLogsStatus}
      />
      <KnowledgeAdminList
        candidates={candidates}
        isDemo={runtime.mode === "demo"}
      />
    </DetailShell>
  );
}
