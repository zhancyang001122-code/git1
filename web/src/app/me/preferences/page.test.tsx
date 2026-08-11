import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  return {
    getUser,
    createServerSupabaseClient: vi.fn(async () => ({
      auth: { getUser },
    })),
    redirect: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import Page from "@/app/me/preferences/page";

describe("preferences page authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  });

  it("redirects anonymous visitors to login with a safe return path", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await Page();

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=%2Fme%2Fpreferences",
    );
  });

  it("redirects Demo visitors without constructing a Supabase client", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

    await Page();

    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=%2Fme%2Fpreferences",
    );
  });
});
