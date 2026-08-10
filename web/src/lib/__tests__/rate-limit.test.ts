import { describe, expect, it } from "vitest";

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
