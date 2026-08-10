import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicSupabaseConfig } from "@/lib/supabase/config";

export async function createServerSupabaseClient() {
  const config = publicSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, options, value }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies; middleware/session refresh owns that path.
        }
      },
    },
  });
}
