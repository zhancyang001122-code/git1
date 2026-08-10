import type { SupabaseClient } from "@supabase/supabase-js";

import type { AIOpsRepository } from "@/features/ai-ops/repository";
import { createSupabaseAIOpsRepository } from "@/features/ai-ops/repository";
import { createDemoRepository } from "@/features/business/demo-repository";
import type { BusinessRepository } from "@/features/business/repository";
import { createSupabaseBusinessRepository } from "@/features/business/supabase-repository";
import type { ConversationRepository } from "@/features/conversation/repository";
import { createSupabaseConversationRepository } from "@/features/conversation/repository";
import type { MemoryRepository } from "@/features/memory/repository";
import { createSupabaseMemoryRepository } from "@/features/memory/repository";
import { AppError } from "@/lib/errors";
import {
  parsePublicEnv,
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

export interface RepositoryMode {
  mode: "supabase" | "demo" | "demo_fallback";
  reason?: string;
}

export interface RepositoryBundle {
  business: BusinessRepository;
  memory: MemoryRepository;
  conversations: ConversationRepository;
  aiOps: AIOpsRepository;
  mode: RepositoryMode;
}

interface RepositoryFactoryOptions {
  environment?: EnvironmentInput;
  serverClient?: SupabaseClient;
  adminClient?: SupabaseClient;
}

function persistenceDisabled(): never {
  throw new AppError({
    code: "DEMO_PERSISTENCE_DISABLED",
    message: "演示模式不会伪装成已写入云端数据",
  });
}

function adminUnavailable(): never {
  throw new AppError({
    code: "SUPABASE_ADMIN_NOT_CONFIGURED",
    message: "Supabase 管理端尚未配置",
  });
}

function createReadOnlyDemoRepositories() {
  const memory: MemoryRepository = {
    async getPreferences() {
      return null;
    },
    async upsertPreferences() {
      return persistenceDisabled();
    },
  };
  const conversations: ConversationRepository = {
    async createSession() {
      return persistenceDisabled();
    },
    async listSessions() {
      return [];
    },
    async appendMessage() {
      return persistenceDisabled();
    },
    async listMessages() {
      return [];
    },
  };
  const aiOps: AIOpsRepository = {
    async recordToolRun() {
      return persistenceDisabled();
    },
    async upsertFeedback() {
      return persistenceDisabled();
    },
  };
  return { memory, conversations, aiOps };
}

function createUnavailableAIOpsRepository(): AIOpsRepository {
  return {
    async recordToolRun() {
      return adminUnavailable();
    },
    async upsertFeedback() {
      return adminUnavailable();
    },
  };
}

function isFallbackEligible(error: unknown): boolean {
  return error instanceof AppError && error.code === "SUPABASE_QUERY_FAILED";
}

function withVisibleFallback(
  live: BusinessRepository,
  demo: BusinessRepository,
  mode: RepositoryMode,
): BusinessRepository {
  const run = async <T>(
    liveRead: () => Promise<T>,
    demoRead: () => Promise<T>,
  ): Promise<T> => {
    if (mode.mode === "demo_fallback") return demoRead();
    try {
      return await liveRead();
    } catch (error) {
      if (!isFallbackEligible(error)) throw error;
      mode.mode = "demo_fallback";
      mode.reason = "Supabase 暂时不可用，已显式回退到演示数据";
      return demoRead();
    }
  };

  return {
    listHouses: (filter) =>
      run(
        () => live.listHouses(filter),
        () => demo.listHouses(filter),
      ),
    getHouse: (id) =>
      run(
        () => live.getHouse(id),
        () => demo.getHouse(id),
      ),
    listDeals: (filter) =>
      run(
        () => live.listDeals(filter),
        () => demo.listDeals(filter),
      ),
    getDeal: (id) =>
      run(
        () => live.getDeal(id),
        () => demo.getDeal(id),
      ),
    listStores: () =>
      run(
        () => live.listStores(),
        () => demo.listStores(),
      ),
    getStore: (id) =>
      run(
        () => live.getStore(id),
        () => demo.getStore(id),
      ),
    listProducts: (filter) =>
      run(
        () => live.listProducts(filter),
        () => demo.listProducts(filter),
      ),
    getProduct: (id) =>
      run(
        () => live.getProduct(id),
        () => demo.getProduct(id),
      ),
    listCommunityPosts: (filter) =>
      run(
        () => live.listCommunityPosts(filter),
        () => demo.listCommunityPosts(filter),
      ),
    getCommunityPost: (id) =>
      run(
        () => live.getCommunityPost(id),
        () => demo.getCommunityPost(id),
      ),
  };
}

async function defaultServerClient(): Promise<SupabaseClient> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  return createServerSupabaseClient();
}

async function defaultAdminClient(): Promise<SupabaseClient> {
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  return createAdminSupabaseClient();
}

export async function createRepositories(
  options: RepositoryFactoryOptions = {},
): Promise<RepositoryBundle> {
  const environment = options.environment ?? process.env;
  const publicConfiguration = parsePublicEnv(environment);
  const demo = createDemoRepository();

  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    const readOnly = createReadOnlyDemoRepositories();
    return {
      business: demo,
      ...readOnly,
      mode: { mode: "demo", reason: "产品演示模式已开启" },
    };
  }

  if (
    !publicConfiguration.NEXT_PUBLIC_SUPABASE_URL ||
    !publicConfiguration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new AppError({
      code: "SUPABASE_NOT_CONFIGURED",
      message: "Supabase 尚未配置",
    });
  }

  const serverConfiguration = parseServerEnv(environment);
  const serverClient = options.serverClient ?? (await defaultServerClient());
  const liveBusiness = createSupabaseBusinessRepository(serverClient);
  const mode: RepositoryMode = { mode: "supabase" };
  const business = serverConfiguration.SUPABASE_FALLBACK_TO_DEMO
    ? withVisibleFallback(liveBusiness, demo, mode)
    : liveBusiness;

  let aiOps = createUnavailableAIOpsRepository();
  if (options.adminClient) {
    aiOps = createSupabaseAIOpsRepository(options.adminClient);
  } else if (serverConfiguration.SUPABASE_SERVICE_ROLE_KEY) {
    aiOps = createSupabaseAIOpsRepository(await defaultAdminClient());
  }

  return {
    business,
    memory: createSupabaseMemoryRepository(serverClient),
    conversations: createSupabaseConversationRepository(serverClient),
    aiOps,
    mode,
  };
}
