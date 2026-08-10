import { KnowledgeAdminList } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
import { requireKnowledgeAdminPage } from "@/features/knowledge-ops/page-auth";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireKnowledgeAdminPage();
  const runtime = await createKnowledgeOpsRuntime();
  const candidates = await runtime.service.listCandidates();
  return (
    <DetailShell title="知识运营演示" backHref="/me">
      <KnowledgeAdminList
        candidates={candidates}
        isDemo={runtime.mode === "demo"}
      />
    </DetailShell>
  );
}
