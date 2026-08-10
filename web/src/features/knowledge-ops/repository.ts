import type {
  CandidateDraft,
  CandidateEvidence,
  CandidateInput,
  CandidateSourceType,
  CandidateStatus,
  ReviewInput,
} from "@/features/knowledge-ops/schemas";
import { AppError } from "@/lib/errors";

export interface KnowledgeCandidateRecord {
  id: string;
  sourceType: CandidateSourceType;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  normalizedQuestion: string;
  domain: CandidateInput["domain"];
  reason: string;
  evidence: readonly CandidateEvidence[];
  status: CandidateStatus;
  occurrenceCount: number;
  draft: CandidateDraft | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeReviewRecord {
  id: string;
  candidateId: string;
  decision: ReviewInput["decision"];
  notes: string;
  createdAt: string;
}

export interface PreparedPublication {
  candidateId: string;
  articleId: string;
  versionId: string;
  previousVersionId: string | null;
}

export interface StoredPublicationResult {
  publicationStatus: "published";
  indexStatus: "ready" | "failed";
  evaluationStatus: "passed" | "failed" | "not_run";
  searchable: boolean;
  rollbackAvailable: boolean;
  warnings: readonly string[];
}

export interface KnowledgeOpsRepository {
  enqueueCandidate(
    input: CandidateInput & { normalizedQuestion: string },
  ): Promise<{ candidate: KnowledgeCandidateRecord; deduplicated: boolean }>;
  listCandidates(): Promise<readonly KnowledgeCandidateRecord[]>;
  getCandidate(id: string): Promise<KnowledgeCandidateRecord | null>;
  saveDraft(
    id: string,
    draft: CandidateDraft,
  ): Promise<KnowledgeCandidateRecord>;
  recordReview(input: ReviewInput): Promise<KnowledgeReviewRecord>;
  preparePublication(candidateId: string): Promise<PreparedPublication>;
  publishVersion(publication: PreparedPublication): Promise<void>;
  rollbackPublication(candidateId: string): Promise<{
    articleId: string;
    versionId: string;
  }>;
  savePublicationResult(
    candidateId: string,
    result: StoredPublicationResult,
  ): Promise<void>;
}

function missingCandidate(): never {
  throw new AppError({
    code: "KNOWLEDGE_CANDIDATE_NOT_FOUND",
    message: "没有找到该知识候选",
    status: 404,
  });
}

export function createInMemoryKnowledgeOpsRepository(
  seed: readonly KnowledgeCandidateRecord[] = [],
): KnowledgeOpsRepository {
  const candidates = new Map(
    seed.map((candidate) => [candidate.id, candidate]),
  );
  const reviews: KnowledgeReviewRecord[] = [];
  const publicationResults = new Map<string, StoredPublicationResult>();
  const preparedPublications = new Map<string, PreparedPublication>();
  const activeVersions = new Map<
    string,
    { articleId: string; versionId: string }
  >();
  const publicationKeys = new Map<string, string>();

  function update(
    id: string,
    changes: Partial<KnowledgeCandidateRecord>,
  ): KnowledgeCandidateRecord {
    const current = candidates.get(id);
    if (!current) missingCandidate();
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    candidates.set(id, next);
    return next;
  }

  return {
    async enqueueCandidate(input) {
      const existing = [...candidates.values()].find(
        (candidate) =>
          candidate.normalizedQuestion.toLocaleLowerCase("zh-CN") ===
            input.normalizedQuestion.toLocaleLowerCase("zh-CN") &&
          candidate.domain === input.domain &&
          ["pending", "drafted", "reviewing"].includes(candidate.status),
      );
      if (existing) {
        const candidate = update(existing.id, {
          occurrenceCount: existing.occurrenceCount + 1,
          sourceType: input.sourceType,
          sourceSessionId: input.sessionId,
          sourceMessageId: input.messageId,
          reason: input.reason,
          ...(input.evidence.length > 0 && { evidence: input.evidence }),
        });
        return { candidate, deduplicated: true };
      }
      const now = new Date().toISOString();
      const candidate: KnowledgeCandidateRecord = {
        id: crypto.randomUUID(),
        sourceType: input.sourceType,
        sourceSessionId: input.sessionId,
        sourceMessageId: input.messageId,
        normalizedQuestion: input.normalizedQuestion,
        domain: input.domain,
        reason: input.reason,
        evidence: input.evidence,
        status: "pending",
        occurrenceCount: 1,
        draft: null,
        createdAt: now,
        updatedAt: now,
      };
      candidates.set(candidate.id, candidate);
      return { candidate, deduplicated: false };
    },

    async listCandidates() {
      return [...candidates.values()].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    },

    async getCandidate(id) {
      return candidates.get(id) ?? null;
    },

    async saveDraft(id, draft) {
      return update(id, { draft, status: "drafted" });
    },

    async recordReview(input) {
      const current = candidates.get(input.candidateId);
      if (!current) missingCandidate();
      if (input.decision === "approve") {
        update(input.candidateId, { draft: input.draft, status: "approved" });
      } else if (input.decision === "reject") {
        update(input.candidateId, { status: "rejected" });
      } else {
        update(input.candidateId, { status: "drafted" });
      }
      const review: KnowledgeReviewRecord = {
        id: crypto.randomUUID(),
        candidateId: input.candidateId,
        decision: input.decision,
        notes: input.notes,
        createdAt: new Date().toISOString(),
      };
      reviews.push(review);
      return review;
    },

    async preparePublication(candidateId) {
      const candidate = candidates.get(candidateId);
      if (!candidate) missingCandidate();
      if (candidate.status !== "approved" || !candidate.draft) {
        throw new AppError({
          code: "KNOWLEDGE_CANDIDATE_NOT_APPROVED",
          message: "知识候选尚未完成审核批准",
          status: 409,
        });
      }
      const key = `${candidate.draft.domain}:${candidate.draft.category}`;
      const active = activeVersions.get(key);
      const publication = {
        candidateId,
        articleId: active?.articleId ?? crypto.randomUUID(),
        versionId: crypto.randomUUID(),
        previousVersionId: active?.versionId ?? null,
      };
      preparedPublications.set(candidateId, publication);
      publicationKeys.set(candidateId, key);
      return publication;
    },

    async publishVersion(publication) {
      update(publication.candidateId, { status: "published" });
      const key = publicationKeys.get(publication.candidateId);
      if (key) {
        activeVersions.set(key, {
          articleId: publication.articleId,
          versionId: publication.versionId,
        });
      }
    },

    async rollbackPublication(candidateId) {
      const publication = preparedPublications.get(candidateId);
      const key = publicationKeys.get(candidateId);
      if (!publication?.previousVersionId || !key) {
        throw new AppError({
          code: "KNOWLEDGE_ROLLBACK_UNAVAILABLE",
          message: "当前版本没有可回滚的上一版本",
          status: 409,
        });
      }
      activeVersions.set(key, {
        articleId: publication.articleId,
        versionId: publication.previousVersionId,
      });
      return {
        articleId: publication.articleId,
        versionId: publication.previousVersionId,
      };
    },

    async savePublicationResult(candidateId, result) {
      publicationResults.set(candidateId, result);
    },
  };
}
