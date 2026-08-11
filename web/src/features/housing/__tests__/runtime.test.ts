import { describe, expect, it } from "vitest";

import { createHousingRuntime } from "@/features/housing/runtime";

describe("createHousingRuntime", () => {
  it("keeps housing unavailable when no live source is configured", () => {
    const runtime = createHousingRuntime({});

    expect(runtime.mode).toBe("unavailable");
    expect(runtime.service).toBeUndefined();
    expect(runtime.defaultCenter).toEqual({
      label: "武林广场",
      longitude: 120.1551,
      latitude: 30.2741,
    });
  });

  it("prefers Supabase in live mode when URL and server secret are present", () => {
    const runtime = createHousingRuntime({
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
    });

    expect(runtime.mode).toBe("supabase");
    expect(runtime.service).toBeDefined();
  });

  it("uses HTTP only as an explicit local development fallback", () => {
    const runtime = createHousingRuntime({
      HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      HOUSING_API_KEY: "local-key-that-is-at-least-32-characters",
      HOUSING_HTTP_FALLBACK_ENABLED: "true",
      HOUSING_DEFAULT_CENTER_NAME: "武林广场",
      HOUSING_DEFAULT_LONGITUDE: "120.1551",
      HOUSING_DEFAULT_LATITUDE: "30.2741",
      HOUSING_DEFAULT_RADIUS_M: "2500",
    });

    expect(runtime.mode).toBe("http");
    expect(runtime.service).toBeDefined();
    expect(runtime.radiusM).toBe(2_500);
  });

  it("never uses the HTTP fallback in production", () => {
    const runtime = createHousingRuntime({
      NODE_ENV: "production",
      NEXT_PUBLIC_DEMO_MODE: "false",
      HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      HOUSING_API_KEY: "local-key-that-is-at-least-32-characters",
      HOUSING_HTTP_FALLBACK_ENABLED: "true",
    });

    expect(runtime.mode).toBe("unavailable");
    expect(runtime.service).toBeUndefined();
  });

  it("prefers live Supabase when both sources are configured", () => {
    const runtime = createHousingRuntime({
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
      HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      HOUSING_API_KEY: "local-key-that-is-at-least-32-characters",
      HOUSING_HTTP_FALLBACK_ENABLED: "true",
    });

    expect(runtime.mode).toBe("supabase");
  });

  it("rejects partial configuration instead of silently falling back", () => {
    expect(() =>
      createHousingRuntime({
        HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      }),
    ).toThrowError(/同时配置/);
  });
});
