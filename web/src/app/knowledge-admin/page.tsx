import { KnowledgeAdminList } from "@/components/account/knowledge-admin-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="知识运营演示" backHref="/me">
      <KnowledgeAdminList />
    </DetailShell>
  );
}
