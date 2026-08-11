import { redirect } from "next/navigation";

import { PreferencesExperience } from "@/components/account/preferences-experience";
import { DetailShell } from "@/components/layout/detail-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fme%2Fpreferences");
  }
  return (
    <DetailShell title="云端长期偏好" backHref="/me">
      <PreferencesExperience />
    </DetailShell>
  );
}
