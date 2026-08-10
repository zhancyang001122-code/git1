import { FeedbackExperience } from "@/components/account/account-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="知识纠错与反馈" backHref="/me">
      <FeedbackExperience />
    </DetailShell>
  );
}
