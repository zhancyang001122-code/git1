import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { KnowledgeService } from "@/features/knowledge/types";
import { postgresUuidSchema } from "@/lib/database-id";
import { AppError } from "@/lib/errors";

const jobStatusSchema = z.enum([
  "pending",
  "processing",
  "retrying",
  "succeeded",
  "failed",
]);
const jobRowSchema = z.object({
  id: postgresUuidSchema,
  candidate_id: postgresUuidSchema.nullable(),
  version_id: postgresUuidSchema,
  previous_version_id: postgresUuidSchema.nullable(),
  status: jobStatusSchema,
  attempt_count: z.number().int().nonnegative(),
  max_attempts: z.number().int().min(1).max(10),
  available_at: z.string(),
  lease_expires_at: z.string().nullable(),
  locked_by: postgresUuidSchema.nullable(),
  last_error_code: z.string().nullable(),
  result_json: z.record(z.string(), z.unknown()).nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type KnowledgeIndexJobStatus = z.infer<typeof jobStatusSchema>;

export interface KnowledgeIndexJob {
  id: string;
  candidateId: string | null;
  versionId: string;
  previousVersionId: string | null;
  status: KnowledgeIndexJobStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  leaseExpiresAt: string | null;
  lockedBy: string | null;
  lastErrorCode: string | null;
  result: Readonly<Record<string, unknown>> | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeIndexEnqueuer {
  enqueue(input: {
    candidateId: string | null;
    versionId: string;
    previousVersionId: string | null;
  }): Promise<{ id: string; status: KnowledgeIndexJobStatus }>;
}

export interface KnowledgeIndexQueue extends KnowledgeIndexEnqueuer {
  claim(
    workerId: string,
    leaseSeconds: number,
  ): Promise<KnowledgeIndexJob | null>;
  complete(
    jobId: string,
    workerId: string,
    result: Readonly<Record<string, unknown>>,
  ): Promise<KnowledgeIndexJob>;
  fail(
    jobId: string,
    workerId: string,
    errorCode: string,
    retryable: boolean,
    retryDelaySeconds: number,
  ): Promise<KnowledgeIndexJob>;
}

function queueQueryFailed(cause: unknown): never {
  throw new AppError({
    code: "KNOWLEDGE_INDEX_QUEUE_QUERY_FAILED",
    message: "知识索引队列暂时不可用",
    status: 503,
    retryable: true,
    cause,
  });
}

function mapJob(value: unknown): KnowledgeIndexJob {
  const parsed = jobRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError({
      code: "INVALID_KNOWLEDGE_INDEX_JOB_DATA",
      message: "知识索引任务数据格式无效",
      status: 502,
      retryable: true,
      cause: parsed.error,
    });
  }
  const row = parsed.data;
  return {
    id: row.id,
    candidateId: row.candidate_id,
    versionId: row.version_id,
    previousVersionId: row.previous_version_id,
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    leaseExpiresAt: row.lease_expires_at,
    lockedBy: row.locked_by,
    lastErrorCode: row.last_error_code,
    result: row.result_json,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function rpcSingle(
  query: { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> },
  nullable: boolean,
): Promise<KnowledgeIndexJob | null> {
  const result = await query.maybeSingle();
  if (result.error) queueQueryFailed(result.error);
  if (result.data === null) {
    if (nullable) return null;
    queueQueryFailed(new Error("Knowledge index queue RPC returned no row"));
  }
  return mapJob(result.data);
}

export function createSupabaseKnowledgeIndexQueue(
  client: SupabaseClient,
): KnowledgeIndexQueue {
  return {
    async enqueue(input) {
      const job = await rpcSingle(
        client.rpc("enqueue_knowledge_index_job", {
          p_candidate_id: input.candidateId,
          p_version_id: input.versionId,
          p_previous_version_id: input.previousVersionId,
        }),
        false,
      );
      return job!;
    },

    claim(workerId, leaseSeconds) {
      return rpcSingle(
        client.rpc("claim_knowledge_index_job", {
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        }),
        true,
      );
    },

    async complete(jobId, workerId, result) {
      const job = await rpcSingle(
        client.rpc("complete_knowledge_index_job", {
          p_job_id: jobId,
          p_worker_id: workerId,
          p_result_json: result,
        }),
        false,
      );
      return job!;
    },

    async fail(jobId, workerId, errorCode, retryable, retryDelaySeconds) {
      const job = await rpcSingle(
        client.rpc("fail_knowledge_index_job", {
          p_job_id: jobId,
          p_worker_id: workerId,
          p_error_code: errorCode,
          p_retryable: retryable,
          p_retry_delay_seconds: retryDelaySeconds,
        }),
        false,
      );
      return job!;
    },
  };
}

export interface KnowledgeIndexFinalization {
  evaluationStatus: "passed" | "failed" | "not_run";
  searchable: boolean;
  rollbackAvailable: boolean;
  warnings: readonly string[];
}

export type KnowledgeIndexWorkerResult =
  | { status: "idle" }
  | {
      status: "succeeded";
      jobId: string;
      candidateId: string | null;
      versionId: string;
      finalization: KnowledgeIndexFinalization;
    }
  | {
      status: "retrying" | "failed";
      jobId: string;
      candidateId: string | null;
      versionId: string;
      errorCode: string;
    };

export interface KnowledgeIndexWorker {
  runOne(
    workerId: string,
    signal?: AbortSignal,
  ): Promise<KnowledgeIndexWorkerResult>;
}

export function createKnowledgeIndexWorker(options: {
  queue: KnowledgeIndexQueue;
  indexer: Pick<KnowledgeService, "indexVersion">;
  finalize(job: KnowledgeIndexJob): Promise<KnowledgeIndexFinalization>;
  onTerminalFailure?(job: KnowledgeIndexJob, errorCode: string): Promise<void>;
  leaseSeconds?: number;
}): KnowledgeIndexWorker {
  return {
    async runOne(workerId, signal) {
      const parsedWorkerId = postgresUuidSchema.safeParse(workerId);
      if (!parsedWorkerId.success) {
        throw new AppError({
          code: "KNOWLEDGE_INDEX_WORKER_ID_INVALID",
          message: "知识索引 Worker 标识无效",
          status: 500,
          cause: parsedWorkerId.error,
        });
      }
      const job = await options.queue.claim(
        parsedWorkerId.data,
        options.leaseSeconds ?? 55,
      );
      if (!job) return { status: "idle" };
      if (!job.lockedBy) {
        throw new AppError({
          code: "KNOWLEDGE_INDEX_LEASE_INVALID",
          message: "知识索引任务没有有效租约",
          status: 500,
        });
      }

      try {
        const indexResult = await options.indexer.indexVersion(
          job.versionId,
          signal,
        );
        const finalization = await options.finalize(job);
        await options.queue.complete(job.id, job.lockedBy, {
          index: indexResult,
          finalization,
        });
        return {
          status: "succeeded",
          jobId: job.id,
          candidateId: job.candidateId,
          versionId: job.versionId,
          finalization,
        };
      } catch (error) {
        const errorCode =
          error instanceof AppError
            ? error.code
            : "KNOWLEDGE_INDEX_WORKER_FAILED";
        const retryable = error instanceof AppError && error.retryable;
        const retryDelaySeconds = Math.min(
          300,
          10 * 2 ** Math.max(0, job.attemptCount - 1),
        );
        const failedJob = await options.queue.fail(
          job.id,
          job.lockedBy,
          errorCode,
          retryable,
          retryDelaySeconds,
        );
        if (failedJob.status === "failed") {
          await options.onTerminalFailure?.(job, errorCode);
        }
        return {
          status: failedJob.status === "retrying" ? "retrying" : "failed",
          jobId: job.id,
          candidateId: job.candidateId,
          versionId: job.versionId,
          errorCode,
        };
      }
    },
  };
}
