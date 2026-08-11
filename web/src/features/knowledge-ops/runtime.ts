import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateEvaluationMetrics } from "@/features/evaluation/metrics";
import { createKnowledgeRuntime } from "@/features/knowledge/runtime";
import type { KnowledgeService } from "@/features/knowledge/types";
import { createDemoKnowledgeOpsService } from "@/features/knowledge-ops/demo-store";
import type { KnowledgeOpsRepository } from "@/features/knowledge-ops/repository";
import { createKnowledgeOpsService } from "@/features/knowledge-ops/service";
import type { KnowledgeOpsService } from "@/features/knowledge-ops/service";
import { createSupabaseKnowledgeOpsRepository } from "@/features/knowledge-ops/supabase-repository";
import { AppError } from "@/lib/errors";
import {
  parsePublicEnv,
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

export interface KnowledgeOpsRuntime {
  mode: "demo" | "live";
  service: KnowledgeOpsService;
  adminToken: string | undefined;
}

interface KnowledgeOpsRuntimeOptions {
  environment?: EnvironmentInput;
  supabase?: SupabaseClient;
  repository?: KnowledgeOpsRepository;
  knowledgeService?: KnowledgeService;
}

function indexingNotConfigured(): never {
  throw new AppError({
    code: "KNOWLEDGE_INDEXING_NOT_CONFIGURED",
    message: "知识发布需要先配置千问向量服务",
    status: 503,
    retryable: true,
  });
}

function createLiveEvaluator(
  repository: KnowledgeOpsRepository,
  knowledge: KnowledgeService,
) {
  return {
    async run(candidateId: string) {
      const candidate = await repository.getCandidate(candidateId);
      if (!candidate?.draft) {
        throw new AppError({
          code: "KNOWLEDGE_CANDIDATE_DRAFT_MISSING",
          message: "知识候选缺少已审核草稿",
          status: 409,
        });
      }
      const search = await knowledge.search({
        query: candidate.normalizedQuestion,
        domain: candidate.domain,
        category: candidate.draft.category,
        city: null,
        topK: 5,
      });
      const matched = search.chunks.find(
        (chunk) => chunk.title === candidate.draft?.title,
      );
      const checks = [
        Boolean(matched),
        matched?.versionStatus === "published",
        Boolean(
          matched &&
          search.citations.some(
            (citation) => citation.chunkId === matched.chunkId,
          ),
        ),
        !search.lowConfidence && !search.conflict,
      ].map((passed) => ({ passed, score: passed ? 1 : 0 }));
      return {
        runId: crypto.randomUUID(),
        ...calculateEvaluationMetrics(checks),
      };
    },
  };
}

async function resolveRepository(
  options: KnowledgeOpsRuntimeOptions,
): Promise<{ repository: KnowledgeOpsRepository; supabase?: SupabaseClient }> {
  if (options.repository) {
    return {
      repository: options.repository,
      ...(options.supabase && { supabase: options.supabase }),
    };
  }
  const supabase =
    options.supabase ??
    (await import("@/lib/supabase/admin")).createAdminSupabaseClient();
  return {
    repository: createSupabaseKnowledgeOpsRepository(supabase),
    supabase,
  };
}

export async function createKnowledgeOpsRuntime(
  options: KnowledgeOpsRuntimeOptions = {},
): Promise<KnowledgeOpsRuntime> {
  const environment = options.environment ?? process.env;
  const publicConfiguration = parsePublicEnv(environment);
  const serverConfiguration = parseServerEnv(environment);
  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return {
      mode: "demo",
      service: createDemoKnowledgeOpsService(),
      adminToken: serverConfiguration.DEMO_ADMIN_TOKEN,
    };
  }

  const { repository, supabase } = await resolveRepository(options);
  const qwenConfigured = Boolean(serverConfiguration.DASHSCOPE_API_KEY);
  if (!options.knowledgeService && qwenConfigured && !supabase) {
    throw new AppError({
      code: "KNOWLEDGE_OPS_LIVE_NOT_CONFIGURED",
      message: "真实知识运营服务缺少 Supabase 配置",
      status: 503,
      retryable: true,
    });
  }
  const knowledge = qwenConfigured
    ? (options.knowledgeService ??
      createKnowledgeRuntime({ environment, supabase }).service)
    : null;

  const service = createKnowledgeOpsService({
    repository,
    indexer: knowledge ?? { indexVersion: async () => indexingNotConfigured() },
    evaluator: knowledge
      ? createLiveEvaluator(repository, knowledge)
      : { run: async () => indexingNotConfigured() },
    hooks: qwenConfigured
      ? undefined
      : { onPreparePublication: indexingNotConfigured },
    isDemo: false,
  });

  return {
    mode: "live",
    service,
    adminToken: serverConfiguration.DEMO_ADMIN_TOKEN,
  };
}
