import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  publicSupabaseConfig: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/config", () => ({
  publicSupabaseConfig: mocks.publicSupabaseConfig,
}));

import { updateSupabaseSession } from "@/lib/supabase/update-session";

describe("updateSupabaseSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    mocks.publicSupabaseConfig.mockReturnValue({
      url: "https://example.supabase.co",
      publishableKey: "public-key",
    });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
  });

  it("skips Supabase session refresh when Demo mode has no credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

    const response = await updateSupabaseSession(
      new NextRequest("https://example.com/api/health"),
    );

    expect(response.status).toBe(200);
    expect(mocks.publicSupabaseConfig).not.toHaveBeenCalled();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("refreshes the Supabase session in Live mode", async () => {
    await updateSupabaseSession(
      new NextRequest("https://example.com/me/preferences"),
    );

    expect(mocks.publicSupabaseConfig).toHaveBeenCalledOnce();
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
});
