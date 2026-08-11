import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createKnowledgeIndexWorker,
  createSupabaseKnowledgeIndexQueue,
  type KnowledgeIndexJob,
} from "@/features/knowledge-ops/index-queue";
import { AppError } from "@/lib/errors";

const jobRow = {
  id: "69000000-0000-4000-8000-000000000001",
  candidate_id: "64000000-0000-4000-8000-000000000001",
  version_id: "62000000-0000-0000-0000-000000000001",
  previous_version_id: null,
  status: "processing",
  attempt_count: 1,
  max_attempts: 3,
  available_at: "2026-08-12T00:00:00.000Z",
  lease_expires_at: "2026-08-12T00:01:00.000Z",
  locked_by: "68000000-0000-4000-8000-000000000001",
  last_error_code: null,
  result_json: null,
  completed_at: null,
  created_at: "2026-08-12T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
};

const job: KnowledgeIndexJob = {
  id: jobRow.id,
  candidateId: jobRow.candidate_id,
  versionId: jobRow.version_id,
  previousVersionId: null,
  status: "processing",
  attemptCount: 1,
  maxAttempts: 3,
  availableAt: jobRow.available_at,
  leaseExpiresAt: jobRow.lease_expires_at,
  lockedBy: jobRow.locked_by,
  lastErrorCode: null,
  result: null,
  completedAt: null,
  createdAt: jobRow.created_at,
  updatedAt: jobRow.updated_at,
};

describe("Supabase knowledge index queue", () => {
  it("claims through the atomic RPC and maps the leased job", async () => {
    const rpc = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: jobRow, error: null })),
    }));
    const queue = createSupabaseKnowledgeIndexQueue({ rpc } as never);

    await expect(queue.claim(jobRow.locked_by, 55)).resolves.toMatchObject(job);
    expect(rpc).toHaveBeenCalledWith("claim_knowledge_index_job", {
      p_worker_id: jobRow.locked_by,
      p_lease_seconds: 55,
    });
  });

  it("normalizes invalid queue rows instead of trusting PostgREST", async () => {
    const rpc = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: { ...jobRow, attempt_count: -1 },
        error: null,
      })),
    }));
    const queue = createSupabaseKnowledgeIndexQueue({
      rpc,
    } as unknown as SupabaseClient);

    await expect(queue.claim(jobRow.locked_by, 55)).rejects.toMatchObject({
      code: "INVALID_KNOWLEDGE_INDEX_JOB_DATA",
    });
  });
});

describe("Knowledge index worker", () => {
  it("completes one leased job and finalizes publication state", async () => {
    const queue = {
      enqueue: vi.fn(),
      claim: vi.fn(async () => job),
      complete: vi.fn(async () => ({ ...job, status: "succeeded" as const })),
      fail: vi.fn(),
    };
    const indexVersion = vi.fn(async () => ({
      versionId: job.versionId,
      totalChunks: 2,
      indexedChunks: 2,
      skippedChunks: 0,
      status: "ready" as const,
    }));
    const finalize = vi.fn(async () => ({
      evaluationStatus: "passed" as const,
      searchable: true,
      rollbackAvailable: false,
      warnings: [],
    }));
    const worker = createKnowledgeIndexWorker({
      queue,
      indexer: { indexVersion },
      finalize,
    });

    await expect(worker.runOne(job.lockedBy!)).resolves.toMatchObject({
      status: "succeeded",
      jobId: job.id,
      finalization: { evaluationStatus: "passed" },
    });
    expect(indexVersion).toHaveBeenCalledWith(job.versionId, undefined);
    expect(finalize).toHaveBeenCalledOnce();
    expect(queue.complete).toHaveBeenCalledOnce();
    expect(queue.fail).not.toHaveBeenCalled();
  });

  it("releases a retryable failure back to the durable queue", async () => {
    const queue = {
      enqueue: vi.fn(),
      claim: vi.fn(async () => job),
      complete: vi.fn(),
      fail: vi.fn(async () => ({ ...job, status: "retrying" as const })),
    };
    const worker = createKnowledgeIndexWorker({
      queue,
      indexer: {
        indexVersion: vi.fn(async () => {
          throw new AppError({
            code: "EMBEDDING_UPSTREAM_FAILED",
            message: "暂时不可用",
            retryable: true,
          });
        }),
      },
      finalize: vi.fn(),
    });

    await expect(worker.runOne(job.lockedBy!)).resolves.toMatchObject({
      status: "retrying",
      errorCode: "EMBEDDING_UPSTREAM_FAILED",
    });
    expect(queue.fail).toHaveBeenCalledWith(
      job.id,
      job.lockedBy,
      "EMBEDDING_UPSTREAM_FAILED",
      true,
      10,
    );
  });
});
