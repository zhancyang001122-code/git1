import { describe, expect, it } from "vitest";

import {
  getServiceConfiguration,
  parsePublicEnv,
  parseServerEnv,
} from "@/lib/env";

describe("environment contract", () => {
  it("allows explicit demo mode without external keys", () => {
    const value = parsePublicEnv({ NEXT_PUBLIC_DEMO_MODE: "true" });

    expect(value.NEXT_PUBLIC_DEMO_MODE).toBe(true);
  });

  it("rejects malformed public URLs", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_DEMO_MODE: "false",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("does not expose server secrets through the public parser", () => {
    const value = parsePublicEnv({
      NEXT_PUBLIC_DEMO_MODE: "true",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      DASHSCOPE_API_KEY: "qwen-secret",
      AMAP_WEB_SERVICE_KEY: "amap-secret",
    });

    expect(value).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(value).not.toHaveProperty("DASHSCOPE_API_KEY");
    expect(value).not.toHaveProperty("AMAP_WEB_SERVICE_KEY");
  });

  it("keeps server credentials in the server parser", () => {
    const value = parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      DASHSCOPE_API_KEY: "qwen-secret",
      AMAP_WEB_SERVICE_KEY: "amap-secret",
    });

    expect(value).toEqual({
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      DASHSCOPE_API_KEY: "qwen-secret",
      AMAP_WEB_SERVICE_KEY: "amap-secret",
      DASHSCOPE_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      AMAP_BASE_URL: "https://restapi.amap.com",
    });
  });

  it("reports disabled services in demo mode without inspecting the network", () => {
    const value = getServiceConfiguration({
      NEXT_PUBLIC_DEMO_MODE: "true",
    });

    expect(value).toEqual({
      mode: "demo",
      services: {
        supabase: "disabled",
        qwen: "disabled",
        amap: "disabled",
      },
    });
  });

  it("reports configured and missing services outside demo mode", () => {
    const value = getServiceConfiguration({
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
      DASHSCOPE_API_KEY: "qwen-secret",
    });

    expect(value).toEqual({
      mode: "live",
      services: {
        supabase: "configured",
        qwen: "configured",
        amap: "missing",
      },
    });
  });
});
