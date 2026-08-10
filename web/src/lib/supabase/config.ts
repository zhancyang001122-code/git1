import { AppError } from "@/lib/errors";
import { parsePublicEnv, serverEnv } from "@/lib/env";

export function publicSupabaseConfig() {
  const env = parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new AppError({
      code: "SUPABASE_NOT_CONFIGURED",
      message: "Supabase 尚未配置",
    });
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function adminSupabaseConfig() {
  const publicConfig = publicSupabaseConfig();
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new AppError({
      code: "SUPABASE_ADMIN_NOT_CONFIGURED",
      message: "Supabase 管理端尚未配置",
    });
  return { ...publicConfig, serviceRoleKey: key };
}
