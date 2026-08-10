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

    const response = await GET();
    const serializedBody = JSON.stringify(await response.json());

    expect(serializedBody).not.toContain("supabase-secret-value");
    expect(serializedBody).not.toContain("qwen-secret-value");
    expect(serializedBody).not.toContain("amap-secret-value");
  });
});
