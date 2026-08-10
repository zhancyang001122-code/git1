import { PreferencesExperience } from "@/components/account/account-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="小智偏好" backHref="/me">
      <PreferencesExperience />
    </DetailShell>
  );
}
