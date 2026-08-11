import "server-only";

import { createClient } from "@supabase/supabase-js";

import { adminSupabaseConfig } from "@/lib/supabase/config";

export function createAdminSupabaseClient() {
  const config = adminSupabaseConfig();
  return createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
