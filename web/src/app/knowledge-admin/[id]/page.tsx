import { notFound } from "next/navigation";
import { KnowledgeAdminDetail } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
import { requireKnowledgeAdminPage } from "@/features/knowledge-ops/page-auth";
import { createKnowledgeOpsRuntime } from "@/features/knowledge-ops/runtime";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireKnowledgeAdminPage();
  const { id } = await params;
  const runtime = await createKnowledgeOpsRuntime();
  let candidate;
  try {
    candidate = await runtime.service.getCandidate(id);
  } catch {
    notFound();
  }
  return (
    <DetailShell title="候选知识审核" backHref="/knowledge-admin">
      <KnowledgeAdminDetail
        candidate={candidate}
        isDemo={runtime.mode === "demo"}
      />
    </DetailShell>
  );
}
