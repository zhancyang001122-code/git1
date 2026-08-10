import { describe, expect, it } from "vitest";

import { createHousingRuntime } from "@/features/housing/runtime";

describe("createHousingRuntime", () => {
  it("keeps housing unavailable when no HTTP service is configured", () => {
    const runtime = createHousingRuntime({});

    expect(runtime.mode).toBe("unavailable");
    expect(runtime.service).toBeUndefined();
    expect(runtime.defaultCenter).toEqual({
      label: "武林广场",
      longitude: 120.1551,
      latitude: 30.2741,
    });
  });

  it("creates the HTTP runtime only when URL and secret are both present", () => {
    const runtime = createHousingRuntime({
      HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      HOUSING_API_KEY: "local-key-that-is-at-least-32-characters",
      HOUSING_DEFAULT_CENTER_NAME: "武林广场",
      HOUSING_DEFAULT_LONGITUDE: "120.1551",
      HOUSING_DEFAULT_LATITUDE: "30.2741",
      HOUSING_DEFAULT_RADIUS_M: "2500",
    });

    expect(runtime.mode).toBe("http");
    expect(runtime.service).toBeDefined();
    expect(runtime.radiusM).toBe(2_500);
  });

  it("rejects partial configuration instead of silently falling back", () => {
    expect(() =>
      createHousingRuntime({
        HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      }),
    ).toThrowError(/同时配置/);
  });
});
