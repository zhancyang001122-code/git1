import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  isMissingAuthSession,
  mapSupabaseAuthError,
} from "@/features/auth/error-map";

export interface AuthRuntime {
  sendOtp(input: { email: string; captchaToken?: string }): Promise<void>;
  verifyOtp(input: { email: string; token: string }): Promise<void>;
  signOut(): Promise<void>;
}

export async function createSupabaseAuthRuntime(): Promise<AuthRuntime> {
  const client = await createServerSupabaseClient();
  return {
    async sendOtp({ captchaToken, email }) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, captchaToken },
      });
      if (error) throw mapSupabaseAuthError(error, "send");
    },
    async verifyOtp({ email, token }) {
      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw mapSupabaseAuthError(error, "verify");
      if (!data.user || !data.session) {
        throw mapSupabaseAuthError(
          { code: "otp_session_missing", status: 400 },
          "verify",
        );
      }
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error && !isMissingAuthSession(error)) {
        throw mapSupabaseAuthError(error, "sign-out");
      }
    },
  };
}
