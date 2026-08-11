import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: mocks })),
}));

import { createSupabaseAuthRuntime } from "@/features/auth/runtime";

describe("Supabase Auth runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: "user-a" }, session: { access_token: "hidden" } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("sends OTP with account creation and optional captcha", async () => {
    const runtime = await createSupabaseAuthRuntime();
    await runtime.sendOtp({
      email: "user@example.com",
      captchaToken: "captcha-token",
    });
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: { shouldCreateUser: true, captchaToken: "captcha-token" },
    });
  });

  it("verifies an email OTP and rejects a missing session", async () => {
    const runtime = await createSupabaseAuthRuntime();
    await runtime.verifyOtp({ email: "user@example.com", token: "123456" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "email",
    });

    mocks.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });
    await expect(
      runtime.verifyOtp({ email: "user@example.com", token: "123456" }),
    ).rejects.toMatchObject({ code: "AUTH_OTP_INVALID" });
  });

  it("makes sign-out idempotent only for a missing session", async () => {
    const runtime = await createSupabaseAuthRuntime();
    mocks.signOut.mockResolvedValueOnce({
      error: { code: "session_not_found", message: "Auth session missing" },
    });
    await expect(runtime.signOut()).resolves.toBeUndefined();

    mocks.signOut.mockResolvedValueOnce({
      error: { code: "provider_failed", message: "provider failed" },
    });
    await expect(runtime.signOut()).rejects.toMatchObject({
      code: "AUTH_UNAVAILABLE",
    });
  });
});
