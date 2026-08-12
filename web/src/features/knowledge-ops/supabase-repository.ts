import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  KnowledgeCandidateRecord,
  KnowledgeOpsRepository,
  KnowledgeReviewRecord,
  PreparedPublication,
  StoredPublicationResult,
} from "@/features/knowledge-ops/repository";
import {
  candidateDraftSchema,
  candidateEvidenceSchema,
  candidateSourceTypeSchema,
  candidateStatusSchema,
} from "@/features/knowledge-ops/schemas";
import { knowledgeDomains } from "@/features/knowledge/types";
import { postgresUuidSchema } from "@/lib/database-id";
import { AppError } from "@/lib/errors";

const candidateRowSchema = z.object({
  id: postgresUuidSchema,
  source_type: candidateSourceTypeSchema,
  source_session_id: postgresUuidSchema.nullable(),
  source_message_id: postgresUuidSchema.nullable(),
  normalized_question: z.string(),
  domain: z.enum(knowledgeDomains).nullable(),
  reason: z.string(),
  evidence_json: z.array(candidateEvidenceSchema),
  status: candidateStatusSchema,
  occurrence_count: z.number().int().positive(),
  draft_json: candidateDraftSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const reviewRowSchema = z.object({
  id: postgresUuidSchema,
  candidate_id: postgresUuidSchema,
  decision: z.enum(["approve", "reject", "request_changes"]),
  notes: z.string(),
  created_at: z.string(),
});
const publicationRowSchema = z.object({
  candidate_id: postgresUuidSchema,
  article_id: postgresUuidSchema,
  version_id: postgresUuidSchema,
  previous_version_id: postgresUuidSchema.nullable(),
});
const rollbackRowSchema = z.object({
  article_id: postgresUuidSchema,
  version_id: postgresUuidSchema,
});

const CANDIDATE_COLUMNS =
  "id,source_type,source_session_id,source_message_id,normalized_question,domain,reason,evidence_json,status,occurrence_count,draft_json,created_at,updated_at";
const REVIEW_COLUMNS = "id,candidate_id,decision,notes,created_at";

function queryFailed(cause: unknown): never {
  throw new AppError({
    code: "KNOWLEDGE_OPS_QUERY_FAILED",
    message: "知识运营数据暂时不可用",
    status: 503,
    retryable: true,
    cause,
  });
}

function invalidResponse(label: string, cause: unknown): never {
  throw new AppError({
    code: "KNOWLEDGE_OPS_INVALID_RESPONSE",
    message: `${label}数据格式无效`,
    status: 502,
    retryable: true,
    cause,
  });
}

function parseRow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) invalidResponse(label, parsed.error);
  return parsed.data;
}

function firstRow(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function mapCandidate(value: unknown): KnowledgeCandidateRecord {
  const row = parseRow(candidateRowSchema, value, "知识候选");
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceSessionId: row.source_session_id,
    sourceMessageId: row.source_message_id,
    normalizedQuestion: row.normalized_question,
    domain: row.domain,
    reason: row.reason,
    evidence: row.evidence_json,
    status: row.status,
    occurrenceCount: row.occurrence_count,
    draft: row.draft_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReview(value: unknown): KnowledgeReviewRecord {
  const row = parseRow(reviewRowSchema, value, "知识审核");
  return {
    id: row.id,
    candidateId: row.candidate_id,
    decision: row.decision,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapPublication(value: unknown): PreparedPublication {
  const row = parseRow(publicationRowSchema, firstRow(value), "知识发布");
  return {
    candidateId: row.candidate_id,
    articleId: row.article_id,
    versionId: row.version_id,
    previousVersionId: row.previous_version_id,
  };
}

async function getCandidate(
  client: SupabaseClient,
  id: string,
): Promise<KnowledgeCandidateRecord | null> {
  const result = await client
    .from("knowledge_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (result.error) queryFailed(result.error);
  return result.data === null ? null : mapCandidate(result.data);
}

async function requireCandidate(
  client: SupabaseClient,
  id: string,
): Promise<KnowledgeCandidateRecord> {
  const candidate = await getCandidate(client, id);
  if (!candidate) {
    throw new AppError({
      code: "KNOWLEDGE_CANDIDATE_NOT_FOUND",
      message: "没有找到该知识候选",
      status: 404,
    });
  }
  return candidate;
}

export function createSupabaseKnowledgeOpsRepository(
  client: SupabaseClient,
): KnowledgeOpsRepository {
  return {
    async enqueueCandidate(input) {
      const result = await client.rpc("enqueue_knowledge_candidate", {
        p_source_type: input.sourceType,
        p_source_session_id: input.sessionId,
        p_source_message_id: input.messageId,
        p_normalized_question: input.normalizedQuestion,
        p_domain: input.domain,
        p_reason: input.reason,
        p_evidence_json: input.evidence,
      });
      if (result.error) queryFailed(result.error);
      const candidateId = parseRow(
        postgresUuidSchema,
        result.data,
        "知识候选编号",
      );
      const candidate = await requireCandidate(client, candidateId);
      return {
        candidate,
        deduplicated: candidate.occurrenceCount > 1,
      };
    },

    async createManualDraft(input) {
      const result = await client.rpc("create_knowledge_candidate_draft", {
        p_normalized_question: input.normalizedQuestion,
        p_draft_json: input.draft,
      });
      if (result.error) queryFailed(result.error);
      const candidateId = parseRow(
        postgresUuidSchema,
        result.data,
        "知识候选编号",
      );
      const candidate = await requireCandidate(client, candidateId);
      return {
        candidate,
        deduplicated: candidate.occurrenceCount > 1,
      };
    },

    async listCandidates() {
      const result = await client
        .from("knowledge_candidates")
        .select(CANDIDATE_COLUMNS)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (result.error) queryFailed(result.error);
      const rows = z.array(z.unknown()).safeParse(result.data);
      if (!rows.success) invalidResponse("知识候选列表", rows.error);
      return rows.data.map(mapCandidate);
    },

    getCandidate(id) {
      return getCandidate(client, id);
    },

    async saveDraft(id, draft) {
      const result = await client.rpc("save_knowledge_candidate_draft", {
        p_candidate_id: id,
        p_draft_json: draft,
      });
      if (result.error) queryFailed(result.error);
      return requireCandidate(client, id);
    },

    async recordReview(input) {
      const result = await client.rpc("review_knowledge_candidate", {
        p_candidate_id: input.candidateId,
        p_decision: input.decision,
        p_notes: input.notes,
        p_draft_json: input.decision === "approve" ? input.draft : null,
      });
      if (result.error) queryFailed(result.error);
      const reviewId = parseRow(
        postgresUuidSchema,
        result.data,
        "知识审核编号",
      );
      const reviewResult = await client
        .from("knowledge_reviews")
        .select(REVIEW_COLUMNS)
        .eq("id", reviewId)
        .single();
      if (reviewResult.error) queryFailed(reviewResult.error);
      return mapReview(reviewResult.data);
    },

    async preparePublication(candidateId) {
      const result = await client.rpc("prepare_knowledge_publication", {
        p_candidate_id: candidateId,
      });
      if (result.error) queryFailed(result.error);
      return mapPublication(result.data);
    },

    async publishVersion(publication) {
      const result = await client.rpc("publish_knowledge_candidate", {
        p_candidate_id: publication.candidateId,
        p_article_id: publication.articleId,
        p_version_id: publication.versionId,
      });
      if (result.error) queryFailed(result.error);
    },

    async rollbackPublication(candidateId) {
      const result = await client.rpc("rollback_knowledge_candidate", {
        p_candidate_id: candidateId,
      });
      if (result.error) queryFailed(result.error);
      const row = parseRow(
        rollbackRowSchema,
        firstRow(result.data),
        "知识回滚",
      );
      return { articleId: row.article_id, versionId: row.version_id };
    },

    async savePublicationResult(
      candidateId: string,
      result: StoredPublicationResult,
    ) {
      const query = await client
        .from("knowledge_candidates")
        .update({ publication_result_json: result })
        .eq("id", candidateId);
      if (query.error) queryFailed(query.error);
    },
  };
}
