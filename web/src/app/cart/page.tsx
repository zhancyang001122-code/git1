import { DetailShell } from "@/components/layout/detail-shell";
import { CartExperience } from "@/components/market/cart-experience";
import { demoProducts } from "@/features/business/demo-data";

export default function CartPage() {
  return (
    <DetailShell title="购物车" backHref="/market">
      <CartExperience products={demoProducts} />
    </DetailShell>
  );
}
