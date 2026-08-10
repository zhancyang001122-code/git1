import { AccountHistoryExperience } from "@/components/account/account-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="浏览与对话历史" backHref="/me">
      <AccountHistoryExperience />
    </DetailShell>
  );
}
