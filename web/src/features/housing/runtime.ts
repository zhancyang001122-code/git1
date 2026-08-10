import "server-only";

import { HousingHttpAdapter } from "@/features/housing/http-adapter";
import type { HousingRuntime } from "@/features/housing/types";
import {
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

export function createHousingRuntime(
  environment: EnvironmentInput = process.env,
): HousingRuntime {
  const configuration = parseServerEnv(environment);
  const defaultCenter = {
    label: configuration.HOUSING_DEFAULT_CENTER_NAME,
    longitude: configuration.HOUSING_DEFAULT_LONGITUDE,
    latitude: configuration.HOUSING_DEFAULT_LATITUDE,
  };
  if (!configuration.HOUSING_API_BASE_URL || !configuration.HOUSING_API_KEY) {
    return {
      mode: "unavailable",
      defaultCenter,
      radiusM: configuration.HOUSING_DEFAULT_RADIUS_M,
    };
  }
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
