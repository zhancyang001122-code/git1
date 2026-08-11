import "server-only";

import { createClient } from "@supabase/supabase-js";

import { HousingHttpAdapter } from "@/features/housing/http-adapter";
import { HistoricalHousingSupabaseAdapter } from "@/features/housing/supabase-adapter";
import type { HousingRuntime } from "@/features/housing/types";
import {
  parsePublicEnv,
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

function isLocalHttpUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return new Set(["127.0.0.1", "localhost", "::1"]).has(hostname);
}

export function createHousingRuntime(
  environment: EnvironmentInput = process.env,
): HousingRuntime {
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
      service: new HistoricalHousingSupabaseAdapter({
        client,
        timeoutMs: configuration.HOUSING_API_TIMEOUT_MS,
      }),
      defaultCenter,
      radiusM: configuration.HOUSING_DEFAULT_RADIUS_M,
    };
  }
  if (
    configuration.HOUSING_HTTP_FALLBACK_ENABLED &&
    environment.NODE_ENV !== "production" &&
    configuration.HOUSING_API_BASE_URL &&
    configuration.HOUSING_API_KEY &&
    isLocalHttpUrl(configuration.HOUSING_API_BASE_URL)
  ) {
    return {
      mode: "http",
      service: new HousingHttpAdapter({
        baseUrl: configuration.HOUSING_API_BASE_URL,
        apiKey: configuration.HOUSING_API_KEY,
        timeoutMs: configuration.HOUSING_API_TIMEOUT_MS,
      }),
      defaultCenter,
      radiusM: configuration.HOUSING_DEFAULT_RADIUS_M,
    };
  }
  return {
    mode: "unavailable",
    defaultCenter,
    radiusM: configuration.HOUSING_DEFAULT_RADIUS_M,
  };
}
