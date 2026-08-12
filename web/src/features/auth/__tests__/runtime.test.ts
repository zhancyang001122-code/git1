import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: mocks })),
}));

import { createSupabaseAuthRuntime } from "@/features/auth/runtime";

describe("Supabase Auth runtime", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEMO_AUTH_EMAIL", "demo@example.test");
    vi.stubEnv("DEMO_AUTH_PASSWORD", "test-only-random-demo-password-32chars");
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-a" }, session: { access_token: "hidden" } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("signs in only with server-side demo credentials", async () => {
    const runtime = await createSupabaseAuthRuntime();
    await runtime.signInDemo();
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "demo@example.test",
      password: "test-only-random-demo-password-32chars",
    });

    mocks.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });
    await expect(runtime.signInDemo()).rejects.toMatchObject({
      code: "AUTH_UNAVAILABLE",
    });
  });

  it("fails closed when server-side demo credentials are missing", async () => {
    vi.stubEnv("DEMO_AUTH_EMAIL", "");
    vi.stubEnv("DEMO_AUTH_PASSWORD", "");
    const runtime = await createSupabaseAuthRuntime();
    await expect(runtime.signInDemo()).rejects.toMatchObject({
      code: "AUTH_UNAVAILABLE",
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
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
