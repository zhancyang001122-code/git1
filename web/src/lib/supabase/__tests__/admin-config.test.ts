import { afterEach, describe, expect, it, vi } from "vitest";

import { adminSupabaseConfig } from "@/lib/supabase/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configurePublicSupabase() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_public");
}

describe("adminSupabaseConfig", () => {
  it("prefers the new Supabase secret key", () => {
    configurePublicSupabase();
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_preferred");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role");

    expect(adminSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_public",
      secretKey: "sb_secret_preferred",
    });
  });

  it("temporarily accepts the legacy environment variable", () => {
    configurePublicSupabase();
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role");

    expect(adminSupabaseConfig().secretKey).toBe("legacy-service-role");
  });

  it("prefers the server-only Supabase URL for admin traffic", () => {
    configurePublicSupabase();
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_local");

    expect(adminSupabaseConfig().url).toBe("http://127.0.0.1:54321");
  });
});
