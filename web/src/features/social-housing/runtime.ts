import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SocialHousingSupabaseAdapter } from "@/features/social-housing/supabase-adapter";
import type { SocialHousingRuntime } from "@/features/social-housing/types";
import {
  parsePublicEnv,
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

export function createSocialHousingRuntime(
  environment: EnvironmentInput = process.env,
): SocialHousingRuntime {
  const configuration = parseServerEnv(environment);
  const publicConfiguration = parsePublicEnv(environment);
  const defaultCenter = {
    label: configuration.HOUSING_DEFAULT_CENTER_NAME,
    longitude: configuration.HOUSING_DEFAULT_LONGITUDE,
    latitude: configuration.HOUSING_DEFAULT_LATITUDE,
  };

  if (
    !publicConfiguration.NEXT_PUBLIC_DEMO_MODE &&
    publicConfiguration.NEXT_PUBLIC_SUPABASE_URL &&
    configuration.SUPABASE_SECRET_KEY
  ) {
    const client = createClient(
      publicConfiguration.NEXT_PUBLIC_SUPABASE_URL,
      configuration.SUPABASE_SECRET_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    return {
      mode: "supabase",
      service: new SocialHousingSupabaseAdapter({
        client,
        timeoutMs: configuration.HOUSING_API_TIMEOUT_MS,
      }),
      defaultCenter,
    };
  }

  return { mode: "unavailable", defaultCenter };
}
