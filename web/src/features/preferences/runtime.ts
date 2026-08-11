import "server-only";

import { isMissingAuthSession } from "@/features/auth/error-map";
import { createSupabaseMemoryRepository } from "@/features/memory/repository";
import { createPreferencesService } from "@/features/preferences/service";
import type {
  PreferencePatchInput,
  PreferencesResponse,
} from "@/features/preferences/schemas";
import { AppError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface PreferencesApiRuntime {
  getAuthenticatedUserId(): Promise<string | null>;
  getPreferences(userId: string): Promise<PreferencesResponse>;
  patchPreferences(
    userId: string,
    input: PreferencePatchInput,
  ): Promise<PreferencesResponse>;
}

export async function createPreferencesApiRuntime(): Promise<PreferencesApiRuntime> {
  const client = await createServerSupabaseClient();
  const service = createPreferencesService(
    createSupabaseMemoryRepository(client),
  );
  return {
    async getAuthenticatedUserId() {
      const { data, error } = await client.auth.getUser();
      if (error) {
        const status = typeof error.status === "number" ? error.status : null;
        if (status === 401 || isMissingAuthSession(error)) return null;
        throw new AppError({
          code: "AUTH_UNAVAILABLE",
          message: "登录服务暂时不可用，请稍后重试",
          status: 503,
          retryable: true,
          cause: error,
        });
      }
      return data.user?.id ?? null;
    },
    getPreferences: (userId) => service.get(userId),
    patchPreferences: (userId, input) => service.patch(userId, input),
  };
}
