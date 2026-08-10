import { FavoritesExperience } from "@/components/account/account-experiences";
import { DetailShell } from "@/components/layout/detail-shell";
export default function Page() {
  return (
    <DetailShell title="我的收藏" backHref="/me">
      <FavoritesExperience />
    </DetailShell>
  );
}
