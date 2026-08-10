import { notFound } from "next/navigation";
import { KnowledgeAdminDetail } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
import { demoKnowledgeCandidates } from "@/features/account/demo-knowledge-data";
export function generateStaticParams() {
  return demoKnowledgeCandidates.map((candidate) => ({ id: candidate.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = demoKnowledgeCandidates.find((item) => item.id === id);
  if (!candidate) notFound();
  return (
    <DetailShell title="候选知识审核" backHref="/knowledge-admin">
      <KnowledgeAdminDetail candidate={candidate} />
    </DetailShell>
  );
}
