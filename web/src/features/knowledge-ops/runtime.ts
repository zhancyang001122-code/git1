import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateEvaluationMetrics } from "@/features/evaluation/metrics";
import { createKnowledgeRuntime } from "@/features/knowledge/runtime";
import type { KnowledgeService } from "@/features/knowledge/types";
import { createDemoKnowledgeOpsService } from "@/features/knowledge-ops/demo-store";
import {
  createKnowledgeIndexWorker,
  createSupabaseKnowledgeIndexQueue,
  type KnowledgeIndexJob,
  type KnowledgeIndexQueue,
  type KnowledgeIndexWorker,
  type KnowledgeIndexFinalization,
} from "@/features/knowledge-ops/index-queue";
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
  indexQueue?: KnowledgeIndexQueue;
}

export interface KnowledgeIndexWorkerRuntime {
  worker: KnowledgeIndexWorker;
  cronSecret: string | undefined;
  adminToken: string | undefined;
}

function indexingNotConfigured(): never {
  throw new AppError({
    code: "KNOWLEDGE_INDEXING_NOT_CONFIGURED",
    message: "知识发布需要先配置千问向量服务",
    status: 503,
    retryable: true,
  });
}

export function createLiveEvaluator(
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
  const indexQueue =
    options.indexQueue ??
    (supabase ? createSupabaseKnowledgeIndexQueue(supabase) : undefined);

  const service = createKnowledgeOpsService({
    repository,
    indexer: knowledge ?? { indexVersion: async () => indexingNotConfigured() },
    ...(indexQueue && { indexQueue }),
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

function publicationFinalization(
  evaluationFailed: boolean,
  previousVersionId: string | null,
): KnowledgeIndexFinalization {
  const rollbackAvailable = evaluationFailed && previousVersionId !== null;
  return {
    evaluationStatus: evaluationFailed ? "failed" : "passed",
    searchable: true,
    rollbackAvailable,
    warnings: evaluationFailed
      ? [
          "EVALUATION_FAILED",
          ...(!rollbackAvailable ? ["NO_ROLLBACK_TARGET"] : []),
        ]
      : [],
  };
}

async function finalizeIndexedPublication(
  repository: KnowledgeOpsRepository,
  evaluator: ReturnType<typeof createLiveEvaluator>,
  job: KnowledgeIndexJob,
): Promise<KnowledgeIndexFinalization> {
  if (!job.candidateId) {
    return {
      evaluationStatus: "not_run",
      searchable: true,
      rollbackAvailable: false,
      warnings: ["EVALUATION_SKIPPED_NO_CANDIDATE"],
    };
  }

  let evaluationFailed = false;
  try {
    const evaluation = await evaluator.run(job.candidateId);
    evaluationFailed = !evaluation.passed;
  } catch {
    evaluationFailed = true;
  }
  const finalization = publicationFinalization(
    evaluationFailed,
    job.previousVersionId,
  );
  await repository.savePublicationResult(job.candidateId, {
    publicationStatus: "published",
    indexStatus: "ready",
    ...finalization,
  });
  return finalization;
}

export async function createKnowledgeIndexWorkerRuntime(
  options: KnowledgeOpsRuntimeOptions = {},
): Promise<KnowledgeIndexWorkerRuntime> {
  const environment = options.environment ?? process.env;
  const publicConfiguration = parsePublicEnv(environment);
  const serverConfiguration = parseServerEnv(environment);
  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    throw new AppError({
      code: "KNOWLEDGE_INDEX_WORKER_DEMO_DISABLED",
      message: "Demo 模式不运行持久化知识索引 Worker",
      status: 503,
    });
  }
  if (!serverConfiguration.DASHSCOPE_API_KEY) indexingNotConfigured();

  const supabase =
    options.supabase ??
    (await import("@/lib/supabase/admin")).createAdminSupabaseClient();
  const repository =
    options.repository ?? createSupabaseKnowledgeOpsRepository(supabase);
  const knowledge =
    options.knowledgeService ??
    createKnowledgeRuntime({ environment, supabase }).service;
  const queue =
    options.indexQueue ?? createSupabaseKnowledgeIndexQueue(supabase);
  const evaluator = createLiveEvaluator(repository, knowledge);

  return {
    worker: createKnowledgeIndexWorker({
      queue,
      indexer: knowledge,
      finalize: (job) => finalizeIndexedPublication(repository, evaluator, job),
      async onTerminalFailure(job, errorCode) {
        if (!job.candidateId) return;
        await repository.savePublicationResult(job.candidateId, {
          publicationStatus: "published",
          indexStatus: "failed",
          evaluationStatus: "not_run",
          searchable: false,
          rollbackAvailable: job.previousVersionId !== null,
          warnings: ["INDEXING_FAILED", errorCode],
        });
      },
    }),
    cronSecret: serverConfiguration.CRON_SECRET,
    adminToken: serverConfiguration.DEMO_ADMIN_TOKEN,
  };
}
