import { AIOpsOverview } from "@/components/account/ai-ops-overview";
import { KnowledgeAdminList } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
import {
  loadAIOpsDashboard,
  type AIOpsDashboard,
} from "@/features/ai-ops/dashboard";
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
  let dashboardStatus: "ready" | "demo" | "unavailable" =
    runtime.mode === "demo" ? "demo" : "unavailable";
  if (runtime.mode === "live") {
    try {
      dashboard = await loadAIOpsDashboard(createAdminSupabaseClient());
      dashboardStatus = "ready";
    } catch (error) {
      dashboardStatus = "unavailable";
      logger.warn("ai_ops.dashboard_unavailable", {
        requestId: crypto.randomUUID(),
        errorCode:
          error instanceof AppError ? error.code : "UNKNOWN_DASHBOARD_ERROR",
      });
    }
  }
  return (
    <DetailShell title="知识运营演示" backHref="/me">
      <AIOpsOverview dashboard={dashboard} status={dashboardStatus} />
      <KnowledgeAdminList
        candidates={candidates}
        isDemo={runtime.mode === "demo"}
      />
    </DetailShell>
  );
}
