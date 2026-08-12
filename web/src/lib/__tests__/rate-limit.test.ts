import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createEnvironmentFixedWindowRateLimiter,
  createSupabaseFixedWindowRateLimiter,
} from "@/lib/distributed-rate-limit";
import { createFixedWindowRateLimiter } from "@/lib/rate-limit";

describe("fixed window rate limiter", () => {
  it("limits a hashed client key and resets after the window", () => {
    let now = 1_000;
    const limiter = createFixedWindowRateLimiter({
      limit: 2,
      windowMs: 1_000,
      now: () => now,
    });

    expect(limiter.check("client-a")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.check("client-a")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.check("client-a")).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    now = 2_001;
    expect(limiter.check("client-a")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.snapshotKeys()[0]).not.toContain("client-a");
  });
});

describe("Supabase fixed window rate limiter", () => {
  it("keeps the in-memory implementation explicit to Demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const limiter = createEnvironmentFixedWindowRateLimiter({
      scope: "chat_ip",
      limit: 1,
      windowMs: 60_000,
    });

    await expect(limiter.check("client-a")).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(limiter.check("client-a")).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("fails closed when Live shared-counter configuration is incomplete", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("ANONYMOUS_COOKIE_SECRET", "");
    const limiter = createEnvironmentFixedWindowRateLimiter({
      scope: "chat_ip",
      limit: 1,
      windowMs: 60_000,
    });

    await expect(limiter.check("client-a")).rejects.toMatchObject({
      code: "RATE_LIMIT_BACKEND_NOT_CONFIGURED",
      status: 503,
    });
  });

  it("sends only a full SHA-256 client hash to the atomic RPC", async () => {
    const single = vi.fn(async () => ({
      data: { allowed: true, remaining: 4, retry_after_seconds: 37 },
      error: null,
    }));
    const rpc = vi.fn((name: string, input: unknown) => {
      void name;
      void input;
      return { single };
    });
    const limiter = createSupabaseFixedWindowRateLimiter(
      { rpc } as unknown as SupabaseClient,
      { scope: "chat_ip", limit: 5, windowMs: 60_000 },
      "test-rate-limit-hash-secret-value-123456789",
    );

    await expect(limiter.check("203.0.113.42")).resolves.toEqual({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 37,
    });
    expect(rpc).toHaveBeenCalledWith(
      "check_api_rate_limit",
      expect.objectContaining({
        p_scope: "chat_ip",
        p_limit: 5,
        p_window_seconds: 60,
      }),
    );
    const input = rpc.mock.calls[0]?.[1] as { p_key_hash: string } | undefined;
    expect(input).toBeDefined();
    if (!input) throw new Error("RPC input was not captured");
    expect(input.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(input.p_key_hash).not.toContain("203.0.113.42");
    expect(JSON.stringify(input)).not.toContain("test-rate-limit-hash-secret");
  });

  it("fails closed when the shared counter is unavailable", async () => {
    const single = vi.fn(async () => ({
      data: null,
      error: { message: "sensitive database error" },
    }));
    const rpc = vi.fn((name: string, input: unknown) => {
      void name;
      void input;
      return { single };
    });
    const limiter = createSupabaseFixedWindowRateLimiter(
      { rpc } as unknown as SupabaseClient,
      { scope: "knowledge_search_ip", limit: 20, windowMs: 60_000 },
      "test-rate-limit-hash-secret-value-123456789",
    );

    await expect(limiter.check("client-a")).rejects.toMatchObject({
      code: "RATE_LIMIT_BACKEND_UNAVAILABLE",
      status: 503,
      retryable: true,
    });
  });
});
