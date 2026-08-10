import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("reports demo mode without contacting external services", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toEqual({
      app: "xiaozhi",
      mode: "demo",
      services: {
        supabase: "disabled",
        qwen: "disabled",
        amap: "disabled",
        housing: "disabled",
      },
    });
  });

  it("uses only stable public status values", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    vi.stubEnv("DASHSCOPE_API_KEY", "qwen-secret");

    const response = await GET();
    const body = await response.json();

    expect(body.services).toEqual({
      supabase: "configured",
      qwen: "configured",
      amap: "missing",
      housing: "missing",
    });

    const allowedStatuses = ["configured", "missing", "disabled"];
    expect(
      Object.values(body.services).every((status) =>
        allowedStatuses.includes(String(status)),
      ),
    ).toBe(true);
  });

  it("never serializes supplied credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "supabase-secret-value");
    vi.stubEnv("DASHSCOPE_API_KEY", "qwen-secret-value");
    vi.stubEnv("AMAP_WEB_SERVICE_KEY", "amap-secret-value");
    vi.stubEnv("HOUSING_API_BASE_URL", "http://127.0.0.1:8000");
    vi.stubEnv(
      "HOUSING_API_KEY",
      "housing-secret-value-that-is-at-least-32-characters",
    );

    const response = await GET();
    const serializedBody = JSON.stringify(await response.json());

    expect(serializedBody).not.toContain("supabase-secret-value");
    expect(serializedBody).not.toContain("qwen-secret-value");
    expect(serializedBody).not.toContain("amap-secret-value");
    expect(serializedBody).not.toContain(
      "housing-secret-value-that-is-at-least-32-characters",
    );
  });
});
