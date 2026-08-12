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
    expect(value.NEXT_PUBLIC_DEFAULT_LONGITUDE).toBe(120.163102);
    expect(value.NEXT_PUBLIC_DEFAULT_LATITUDE).toBe(30.274085);
  });

  it("validates public fallback coordinates", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_DEFAULT_LONGITUDE: "181" }),
    ).toThrow();
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_DEFAULT_LATITUDE: "north" }),
    ).toThrow();
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
      SUPABASE_SECRET_KEY: "sb_secret_server-only",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      DASHSCOPE_API_KEY: "qwen-secret",
      AMAP_WEB_SERVICE_KEY: "amap-secret",
      SUPABASE_FALLBACK_TO_DEMO: "true",
      AUTH_ALLOWED_EMAIL: "owner@example.com",
    });

    expect(value).not.toHaveProperty("SUPABASE_SECRET_KEY");
    expect(value).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(value).not.toHaveProperty("DASHSCOPE_API_KEY");
    expect(value).not.toHaveProperty("AMAP_WEB_SERVICE_KEY");
    expect(value).not.toHaveProperty("AUTH_ALLOWED_EMAIL");
  });

  it("keeps server credentials in the server parser", () => {
    const value = parseServerEnv({
      SUPABASE_SECRET_KEY: "sb_secret_preferred",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      DASHSCOPE_API_KEY: "qwen-secret",
      AMAP_WEB_SERVICE_KEY: "amap-secret",
      SUPABASE_FALLBACK_TO_DEMO: "true",
      AUTH_ALLOWED_EMAIL: " Owner@Example.COM ",
    });

    expect(value).toMatchObject({
      SUPABASE_SECRET_KEY: "sb_secret_preferred",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      DASHSCOPE_API_KEY: "qwen-secret",
      AMAP_WEB_SERVICE_KEY: "amap-secret",
      SUPABASE_FALLBACK_TO_DEMO: true,
      AUTH_ALLOWED_EMAIL: "owner@example.com",
      DASHSCOPE_MODEL: "qwen-plus",
      DASHSCOPE_EMBEDDING_MODEL: "text-embedding-v4",
      DASHSCOPE_EMBEDDING_DIMENSIONS: 1024,
      DASHSCOPE_RERANK_MODEL: "qwen3-rerank",
      RAG_RERANK_ENABLED: false,
      RAG_VECTOR_WEIGHT: 0.65,
      RAG_TEXT_WEIGHT: 0.35,
      RAG_LOW_CONFIDENCE_THRESHOLD: 0.45,
      RAG_TOP_K: 12,
      RAG_FINAL_K: 5,
      AI_REQUEST_TIMEOUT_MS: 30000,
      TOOL_TIMEOUT_MS: 8000,
      AI_MAX_TOOL_ROUNDS: 8,
      DASHSCOPE_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      AMAP_BASE_URL: "https://restapi.amap.com",
    });
  });

  it("rejects a malformed Auth allowlist email", () => {
    expect(() =>
      parseServerEnv({ AUTH_ALLOWED_EMAIL: "not-an-email" }),
    ).toThrow();
  });

  it("rejects invalid RAG dimensions, weights and rerank configuration", () => {
    expect(() =>
      parseServerEnv({ DASHSCOPE_EMBEDDING_DIMENSIONS: "1536" }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ RAG_VECTOR_WEIGHT: "0.8", RAG_TEXT_WEIGHT: "0.3" }),
    ).toThrow();
    expect(() => parseServerEnv({ RAG_RERANK_ENABLED: "true" })).toThrow();
    expect(() =>
      parseServerEnv({
        DASHSCOPE_RERANK_BASE_URL: "https://example.com/compatible-api/v1",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnv({
        DASHSCOPE_RERANK_BASE_URL:
          "http://workspace.cn-beijing.maas.aliyuncs.com/compatible-api/v1",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnv({
        DASHSCOPE_RERANK_BASE_URL:
          "https://workspace.cn-beijing.maas.aliyuncs.com/wrong-path",
      }),
    ).toThrow();
    expect(
      parseServerEnv({
        RAG_RERANK_ENABLED: "true",
        DASHSCOPE_RERANK_BASE_URL:
          "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-api/v1",
      }),
    ).toMatchObject({ RAG_RERANK_ENABLED: true });
  });

  it("bounds configurable tool timeouts and rounds", () => {
    expect(
      parseServerEnv({ TOOL_TIMEOUT_MS: "500", AI_MAX_TOOL_ROUNDS: "4" }),
    ).toMatchObject({ TOOL_TIMEOUT_MS: 500, AI_MAX_TOOL_ROUNDS: 4 });
    expect(() => parseServerEnv({ AI_MAX_TOOL_ROUNDS: "9" })).toThrow();
    expect(() => parseServerEnv({ TOOL_TIMEOUT_MS: "99" })).toThrow();
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
        housing: "disabled",
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
        housing: "missing",
      },
    });
  });

  it("reports the local housing service independently in demo mode", () => {
    const value = getServiceConfiguration({
      NEXT_PUBLIC_DEMO_MODE: "true",
      HOUSING_HTTP_FALLBACK_ENABLED: "true",
      HOUSING_API_BASE_URL: "http://127.0.0.1:8000",
      HOUSING_API_KEY: "local-key-that-is-at-least-32-characters",
    });

    expect(value.services.housing).toBe("configured");
    expect(value.services.amap).toBe("disabled");
  });

  it("reports historical housing configured from the live Supabase server secret", () => {
    const value = getServiceConfiguration({
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
    });

    expect(value.services.housing).toBe("configured");
  });

  it("rejects an HTTP fallback that points outside the local machine", () => {
    expect(() =>
      parseServerEnv({
        HOUSING_HTTP_FALLBACK_ENABLED: "true",
        HOUSING_API_BASE_URL: "https://housing.example.com",
        HOUSING_API_KEY: "local-key-that-is-at-least-32-characters",
      }),
    ).toThrow(/回环地址/);
  });
});
