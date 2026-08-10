import { createHash } from "node:crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function createFixedWindowRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const now = options.now ?? Date.now;
  function hashed(key: string) {
    return createHash("sha256").update(key).digest("hex").slice(0, 24);
  }
  return {
    check(key: string): RateLimitResult {
      const timestamp = now();
      const safeKey = hashed(key);
      const current = entries.get(safeKey);
      const entry =
        !current || current.resetAt <= timestamp
          ? { count: 0, resetAt: timestamp + options.windowMs }
          : current;
      entry.count += 1;
      entries.set(safeKey, entry);
      return {
        allowed: entry.count <= options.limit,
        remaining: Math.max(0, options.limit - entry.count),
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.resetAt - timestamp) / 1_000),
        ),
      };
    },
    snapshotKeys(): readonly string[] {
      return [...entries.keys()];
    },
  };
}

export function requestClientKey(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local-client";
}
