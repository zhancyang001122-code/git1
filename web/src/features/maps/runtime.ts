import "server-only";

import { AmapAdapter } from "@/features/maps/amap-adapter";
import { FakeMapsService } from "@/features/maps/fake-adapter";
import type { MapsService } from "@/features/maps/types";
import { AppError } from "@/lib/errors";
import {
  parsePublicEnv,
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

export interface MapsRuntime {
  service: MapsService;
  mode: "demo" | "live";
}

class UnavailableMapsService implements MapsService {
  private unavailable(): never {
    throw new AppError({
      code: "AMAP_NOT_CONFIGURED",
      message: "高德地图服务尚未配置",
      status: 503,
    });
  }

  async convertGps(): Promise<never> {
    return this.unavailable();
  }

  async geocode(): Promise<never> {
    return this.unavailable();
  }

  async searchNearby(): Promise<never> {
    return this.unavailable();
  }

  async walkingRoute(): Promise<never> {
    return this.unavailable();
  }
}

export function createMapsRuntime(
  environment: EnvironmentInput = process.env,
): MapsRuntime {
  const publicConfiguration = parsePublicEnv(environment);
  const serverConfiguration = parseServerEnv(environment);
  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return { service: new FakeMapsService(), mode: "demo" };
  }
  if (!serverConfiguration.AMAP_WEB_SERVICE_KEY) {
    return { service: new UnavailableMapsService(), mode: "live" };
  }
  return {
    service: new AmapAdapter({
      key: serverConfiguration.AMAP_WEB_SERVICE_KEY,
      baseUrl: serverConfiguration.AMAP_BASE_URL,
      timeoutMs: serverConfiguration.TOOL_TIMEOUT_MS,
    }),
    mode: "live",
  };
}
