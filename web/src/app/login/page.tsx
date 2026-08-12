import { LoginExperience } from "@/components/auth/login-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { safeNextPath } from "@/features/auth/safe-next";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <DetailShell title="演示账号" backHref="/me">
      <LoginExperience nextPath={safeNextPath(next)} />
    </DetailShell>
  );
}
