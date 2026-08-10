import { OrdersExperience } from "@/components/account/account-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="演示订单" backHref="/me">
      <OrdersExperience />
    </DetailShell>
  );
}
