import { DetailShell } from "@/components/layout/detail-shell";
import { CartExperience } from "@/components/market/cart-experience";
import { RepositoryModeNotice } from "@/components/ui/repository-mode-notice";
import { createRepositories } from "@/features/repositories";

export default async function CartPage() {
  const repositories = await createRepositories();
  const products = await repositories.business.listProducts({ limit: 24 });
  return (
    <DetailShell title="购物车" backHref="/market">
      <RepositoryModeNotice className="mx-4 mt-4" mode={repositories.mode} />
      <CartExperience products={products.items} />
    </DetailShell>
  );
}
