import "server-only";

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import { publicSupabaseConfig } from "@/lib/supabase/config";

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  if (publicEnv().NEXT_PUBLIC_DEMO_MODE) {
    return NextResponse.next({ request });
  }

  const config = publicSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, {
            ...options,
            secure:
              process.env.NODE_ENV === "production" ? true : options.secure,
          }),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
