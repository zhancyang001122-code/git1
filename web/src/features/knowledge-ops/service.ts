import { normalizeCandidateQuestion } from "@/features/knowledge/candidate-sink";
import type { KnowledgeService } from "@/features/knowledge/types";
import type { EvaluationMetrics } from "@/features/evaluation/metrics";
import type {
  CandidateDraft,
  CandidateInput,
  ManualMaterialInput,
  PublishInput,
  RollbackInput,
  ReviewInput,
} from "@/features/knowledge-ops/schemas";
import {
  candidateDraftSchema,
  candidateInputSchema,
  manualMaterialInputSchema,
  publishInputSchema,
  rollbackInputSchema,
  reviewInputSchema,
} from "@/features/knowledge-ops/schemas";
import type {
  KnowledgeCandidateRecord,
  KnowledgeOpsRepository,
} from "@/features/knowledge-ops/repository";
import type { KnowledgeIndexEnqueuer } from "@/features/knowledge-ops/index-queue";
import { AppError } from "@/lib/errors";

export interface EvaluationRunSummary extends EvaluationMetrics {
  runId: string;
}

export interface KnowledgeOpsServiceOptions {
  repository: KnowledgeOpsRepository;
  indexer: Pick<KnowledgeService, "indexVersion">;
  evaluator: { run(candidateId: string): Promise<EvaluationRunSummary> };
  indexQueue?: KnowledgeIndexEnqueuer;
  isDemo: boolean;
  hooks?: {
    onPreparePublication?(): void;
    onPublishVersion?(): void;
    onIndexed?(
      publication: {
        candidateId: string;
        articleId: string;
        versionId: string;
        previousVersionId: string | null;
      },
      candidate: KnowledgeCandidateRecord,
    ): Promise<void> | void;
    onRolledBack?(candidateId: string): Promise<void> | void;
  };
}

export interface PublishResult {
  candidateId: string;
  articleId: string;
  versionId: string;
  publicationStatus: "published";
  indexStatus: "queued" | "ready" | "failed";
  evaluationStatus: "passed" | "failed" | "not_run";
  searchable: boolean;
  rollbackAvailable: boolean;
  warnings: readonly string[];
  isDemo: boolean;
}

export interface KnowledgeOpsService {
  createCandidate(
    input: CandidateInput,
  ): Promise<{ candidateId: string; deduplicated: boolean }>;
  createManualDraft(input: ManualMaterialInput): Promise<{
    candidate: KnowledgeCandidateRecord;
    deduplicated: boolean;
  }>;
  listCandidates(): Promise<readonly KnowledgeCandidateRecord[]>;
  getCandidate(candidateId: string): Promise<KnowledgeCandidateRecord>;
  draftCandidate(
    candidateId: string,
    draft: CandidateDraft,
  ): Promise<KnowledgeCandidateRecord>;
  review(input: ReviewInput): Promise<{ reviewId: string; status: string }>;
  evaluate(candidateId: string): Promise<EvaluationRunSummary>;
  publish(input: PublishInput): Promise<PublishResult>;
  rollback(input: RollbackInput): Promise<{
    candidateId: string;
    articleId: string;
    versionId: string;
    rolledBack: true;
    isDemo: boolean;
  }>;
}

export function createKnowledgeOpsService({
  repository,
  indexer,
  evaluator,
  indexQueue,
  isDemo,
  hooks,
}: KnowledgeOpsServiceOptions): KnowledgeOpsService {
  return {
    async createCandidate(input) {
      const value = candidateInputSchema.parse(input);
      const normalizedQuestion = normalizeCandidateQuestion(value.question);
      const result = await repository.enqueueCandidate({
        ...value,
        normalizedQuestion,
      });
      return {
        candidateId: result.candidate.id,
        deduplicated: result.deduplicated,
      };
    },

    async createManualDraft(input) {
      const value = manualMaterialInputSchema.parse(input);
      return repository.createManualDraft({
        ...value,
        normalizedQuestion: normalizeCandidateQuestion(value.question),
      });
    },

    listCandidates() {
      return repository.listCandidates();
    },

    async getCandidate(candidateId) {
      const candidate = await repository.getCandidate(candidateId);
      if (!candidate) {
        throw new AppError({
          code: "KNOWLEDGE_CANDIDATE_NOT_FOUND",
          message: "没有找到该知识候选",
          status: 404,
        });
      }
      return candidate;
    },

    async draftCandidate(candidateId, draft) {
      const parsedDraft = candidateDraftSchema.parse(draft);
      await this.getCandidate(candidateId);
      return repository.saveDraft(candidateId, parsedDraft);
    },

    async review(input) {
      const value = reviewInputSchema.parse(input);
      const review = await repository.recordReview(value);
      return {
        reviewId: review.id,
        status:
          value.decision === "approve"
            ? "approved"
            : value.decision === "reject"
              ? "rejected"
              : "drafted",
      };
    },

    async evaluate(candidateId) {
      await this.getCandidate(candidateId);
      return evaluator.run(candidateId);
    },

    async publish(input) {
      const value = publishInputSchema.parse(input);
      hooks?.onPreparePublication?.();
      const publication = await repository.preparePublication(
        value.candidateId,
      );
      hooks?.onPublishVersion?.();
      await repository.publishVersion(publication);

      const base = {
        candidateId: value.candidateId,
        articleId: publication.articleId,
        versionId: publication.versionId,
        publicationStatus: "published" as const,
        isDemo,
      };
      if (indexQueue) {
        try {
          await indexQueue.enqueue({
            candidateId: value.candidateId,
            versionId: publication.versionId,
            previousVersionId: publication.previousVersionId,
          });
        } catch {
          const result: PublishResult = {
            ...base,
            indexStatus: "failed",
            evaluationStatus: "not_run",
            searchable: false,
            rollbackAvailable: publication.previousVersionId !== null,
            warnings: ["INDEX_QUEUE_FAILED"],
          };
          await repository.savePublicationResult(value.candidateId, result);
          return result;
        }
        const result: PublishResult = {
          ...base,
          indexStatus: "queued",
          evaluationStatus: "not_run",
          searchable: false,
          rollbackAvailable: publication.previousVersionId !== null,
          warnings: ["INDEXING_QUEUED"],
        };
        await repository.savePublicationResult(value.candidateId, result);
        return result;
      }
      try {
        await indexer.indexVersion(publication.versionId);
      } catch (error) {
        void error;
        const result: PublishResult = {
          ...base,
          indexStatus: "failed",
          evaluationStatus: "not_run",
          searchable: false,
          rollbackAvailable: publication.previousVersionId !== null,
          warnings: ["INDEXING_FAILED"],
        };
        await repository.savePublicationResult(value.candidateId, result);
        return result;
      }

      const indexedCandidate = await this.getCandidate(value.candidateId);
      await hooks?.onIndexed?.(publication, indexedCandidate);

      let evaluationFailed = false;
      try {
        const evaluation = await evaluator.run(value.candidateId);
        evaluationFailed = !evaluation.passed;
      } catch {
        evaluationFailed = true;
      }
      const rollbackAvailable =
        evaluationFailed && publication.previousVersionId !== null;
      const result: PublishResult = {
        ...base,
        indexStatus: "ready",
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
      await repository.savePublicationResult(value.candidateId, result);
      return result;
    },

    async rollback(input) {
      const value = rollbackInputSchema.parse(input);
      await this.getCandidate(value.candidateId);
      const target = await repository.rollbackPublication(value.candidateId);
      await hooks?.onRolledBack?.(value.candidateId);
      return {
        candidateId: value.candidateId,
        ...target,
        rolledBack: true,
        isDemo,
      };
    },
  };
}
