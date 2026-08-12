import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  isMissingAuthSession,
  mapSupabaseAuthError,
} from "@/features/auth/error-map";
import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export interface AuthRuntime {
  signInDemo(): Promise<void>;
  signOut(): Promise<void>;
}

export async function createSupabaseAuthRuntime(): Promise<AuthRuntime> {
  const client = await createServerSupabaseClient();
  return {
    async signInDemo() {
      const environment = serverEnv();
      if (!environment.DEMO_AUTH_EMAIL || !environment.DEMO_AUTH_PASSWORD) {
        throw new AppError({
          code: "AUTH_UNAVAILABLE",
          message: "演示账号尚未配置，请联系作品作者",
          status: 503,
          retryable: true,
        });
      }
      const { data, error } = await client.auth.signInWithPassword({
        email: environment.DEMO_AUTH_EMAIL,
        password: environment.DEMO_AUTH_PASSWORD,
      });
      if (error) throw mapSupabaseAuthError(error);
      if (!data.user || !data.session) {
        throw mapSupabaseAuthError({
          code: "demo_session_missing",
          status: 503,
        });
      }
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error && !isMissingAuthSession(error)) {
        throw mapSupabaseAuthError(error);
      }
    },
  };
}
