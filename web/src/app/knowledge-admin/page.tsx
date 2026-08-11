import {
  AIOpsOverview,
  RAGOpsTrend,
} from "@/components/account/ai-ops-overview";
import { KnowledgeAdminList } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
import {
  loadAIOpsDashboard,
  loadAIModelUsage,
  loadRAGOpsTrend,
  type AIOpsDashboard,
  type RAGOpsTrendPoint,
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

export default async function Page() {
  await requireKnowledgeAdminPage();
  const runtime = await createKnowledgeOpsRuntime();
  const candidates = await runtime.service.listCandidates();
  let dashboard: AIOpsDashboard | null = null;
  let trend: readonly RAGOpsTrendPoint[] | null = null;
  let costEstimate: AIModelCostEstimate | null = null;
  let dashboardStatus: "ready" | "demo" | "unavailable" =
    runtime.mode === "demo" ? "demo" : "unavailable";
  let trendStatus: "ready" | "demo" | "unavailable" = dashboardStatus;
  if (runtime.mode === "live") {
    const client = createAdminSupabaseClient();
    const [dashboardResult, trendResult, usageResult] =
      await Promise.allSettled([
        loadAIOpsDashboard(client),
        loadRAGOpsTrend(client),
        loadAIModelUsage(client),
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
  }
  return (
    <DetailShell title="知识运营演示" backHref="/me">
      <AIOpsOverview
        dashboard={dashboard}
        status={dashboardStatus}
        costEstimate={costEstimate}
      />
      <RAGOpsTrend trend={trend} status={trendStatus} />
      <KnowledgeAdminList
        candidates={candidates}
        isDemo={runtime.mode === "demo"}
      />
    </DetailShell>
  );
}
