"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseConfig } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient() {
  const config = publicSupabaseConfig();
  browserClient ??= createBrowserClient(config.url, config.publishableKey);
  return browserClient;
}
