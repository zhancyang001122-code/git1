import { AddressesExperience } from "@/components/account/account-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="地址管理" backHref="/me">
      <AddressesExperience />
    </DetailShell>
  );
}
