import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import Page from "@/app/me/preferences/page";

describe("preferences page authentication", () => {
  it("redirects anonymous visitors to login with a safe return path", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await Page();

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=%2Fme%2Fpreferences",
    );
  });
});
