import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { parsePublicEnv, parseServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  createFixedWindowRateLimiter,
  type RateLimiter,
} from "@/lib/rate-limit";

const optionsSchema = z
  .object({
    scope: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    limit: z.number().int().min(1).max(1_000),
    windowMs: z
      .number()
      .int()
      .min(1_000)
      .max(3_600_000)
      .refine((value) => value % 1_000 === 0),
  })
  .strict();
const resultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.coerce.number().int().nonnegative(),
  retry_after_seconds: z.coerce.number().int().positive().max(3_600),
});

export interface SharedRateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
}

function hashClientKey(scope: string, key: string, hashSecret: string): string {
  return createHmac("sha256", hashSecret)
    .update(`${scope}:${key}`)
    .digest("hex");
}

export function createSupabaseFixedWindowRateLimiter(
  client: SupabaseClient,
  options: SharedRateLimitOptions,
  hashSecret: string,
): RateLimiter {
  const configuration = optionsSchema.parse(options);
  const secret = z.string().min(32).parse(hashSecret);
  return {
    async check(key) {
      const result = await client
        .rpc("check_api_rate_limit", {
          p_scope: configuration.scope,
          p_key_hash: hashClientKey(configuration.scope, key, secret),
          p_limit: configuration.limit,
          p_window_seconds: configuration.windowMs / 1_000,
        })
        .single();
      if (result.error) {
        throw new AppError({
          code: "RATE_LIMIT_BACKEND_UNAVAILABLE",
          message: "请求保护服务暂时不可用，请稍后重试",
          status: 503,
          retryable: true,
          cause: result.error,
        });
      }
      const parsed = resultSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new AppError({
          code: "RATE_LIMIT_BACKEND_INVALID",
          message: "请求保护服务返回了无效数据",
          status: 503,
          retryable: true,
          cause: parsed.error,
        });
      }
      return {
        allowed: parsed.data.allowed,
        remaining: parsed.data.remaining,
        retryAfterSeconds: parsed.data.retry_after_seconds,
      };
    },
  };
}

export function createEnvironmentFixedWindowRateLimiter(
  options: SharedRateLimitOptions,
): RateLimiter {
  const configuration = optionsSchema.parse(options);
  const local = createFixedWindowRateLimiter(configuration);
  let shared: RateLimiter | null = null;

  return {
    async check(key) {
      const publicEnvironment = parsePublicEnv(process.env);
      const serverEnvironment = parseServerEnv(process.env);
      if (publicEnvironment.NEXT_PUBLIC_DEMO_MODE) return local.check(key);
      const supabaseUrl = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey =
        publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const adminKey =
        serverEnvironment.SUPABASE_SECRET_KEY ??
        serverEnvironment.SUPABASE_SERVICE_ROLE_KEY;
      const hashSecret = serverEnvironment.ANONYMOUS_COOKIE_SECRET;
      if (!supabaseUrl || !publishableKey || !adminKey || !hashSecret) {
        throw new AppError({
          code: "RATE_LIMIT_BACKEND_NOT_CONFIGURED",
          message: "请求保护服务尚未完整配置",
          status: 503,
        });
      }
      if (!shared) {
        const { createAdminSupabaseClient } =
          await import("@/lib/supabase/admin");
        shared = createSupabaseFixedWindowRateLimiter(
          createAdminSupabaseClient(),
          configuration,
          hashSecret,
        );
      }
      return shared.check(key);
    },
  };
}
