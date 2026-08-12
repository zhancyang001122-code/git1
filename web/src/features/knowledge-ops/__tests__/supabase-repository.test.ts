import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseKnowledgeOpsRepository } from "@/features/knowledge-ops/supabase-repository";

function result<T>(value: T) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
    single: vi.fn(() => query),
    update: vi.fn(() => query),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
  return query;
}

const candidateId = "64000000-0000-4000-8000-000000000001";
const reviewId = "65000000-0000-4000-8000-000000000001";
const articleId = "61000000-0000-4000-8000-000000000001";
const versionId = "62000000-0000-4000-8000-000000000001";

const draft = {
  title: "Deposit deduction evidence checklist",
  answerMarkdown: "Verify the contract, inspection report and receipts.",
  changeSummary: "Add evidence requirements",
  sourceReference: "PORTFOLIO-HOUSING-001",
  owner: "Knowledge operations owner",
  domain: "housing" as const,
  category: "deposit",
  effectiveFrom: "2026-08-12",
};

const candidateRow = {
  id: candidateId,
  source_type: "user_feedback",
  source_session_id: null,
  source_message_id: null,
  normalized_question: "What evidence is needed for a deposit deduction?",
  domain: "housing",
  reason: "missing_source",
  evidence_json: [],
  status: "approved",
  occurrence_count: 2,
  draft_json: draft,
  created_at: "2026-08-12T00:00:00.000Z",
  updated_at: "2026-08-12T00:01:00.000Z",
};

describe("Supabase knowledge ops repository", () => {
  it("enqueues through the deduplicating RPC and maps the persisted record", async () => {
    const rpc = vi.fn(() => result({ data: candidateId, error: null }));
    const from = vi.fn(() => result({ data: candidateRow, error: null }));
    const repository = createSupabaseKnowledgeOpsRepository({
      rpc,
      from,
    } as unknown as SupabaseClient);

    const saved = await repository.enqueueCandidate({
      sourceType: "user_feedback",
      sessionId: null,
      messageId: null,
      question: "What evidence is needed for a deposit deduction?",
      normalizedQuestion: "What evidence is needed for a deposit deduction?",
      domain: "housing",
      reason: "missing_source",
      evidence: [],
    });

    expect(rpc).toHaveBeenCalledWith(
      "enqueue_knowledge_candidate",
      expect.objectContaining({
        p_normalized_question:
          "What evidence is needed for a deposit deduction?",
        p_domain: "housing",
      }),
    );
    expect(from).toHaveBeenCalledWith("knowledge_candidates");
    expect(saved).toMatchObject({
      deduplicated: true,
      candidate: { id: candidateId, occurrenceCount: 2, draft },
    });
  });

  it("creates a manual draft through one atomic server-only RPC", async () => {
    const manualRow = {
      ...candidateRow,
      source_type: "human_correction",
      status: "drafted",
      occurrence_count: 1,
      draft_json: { ...draft, versionLabel: "v1.0" },
    };
    const rpc = vi.fn(() => result({ data: candidateId, error: null }));
    const from = vi.fn(() => result({ data: manualRow, error: null }));
    const repository = createSupabaseKnowledgeOpsRepository({
      rpc,
      from,
    } as unknown as SupabaseClient);

    const saved = await repository.createManualDraft({
      question: "What evidence is needed for a deposit deduction?",
      normalizedQuestion: "What evidence is needed for a deposit deduction?",
      draft: { ...draft, versionLabel: "v1.0" },
    });

    expect(rpc).toHaveBeenCalledWith("create_knowledge_candidate_draft", {
      p_normalized_question: "What evidence is needed for a deposit deduction?",
      p_draft_json: { ...draft, versionLabel: "v1.0" },
    });
    expect(saved).toMatchObject({
      deduplicated: false,
      candidate: { id: candidateId, status: "drafted" },
    });
  });

  it("uses server-only lifecycle RPCs for draft, review, publish and rollback", async () => {
    const rpc = vi.fn((name: string) => {
      if (name === "review_knowledge_candidate") {
        return result({ data: reviewId, error: null });
      }
      if (name === "prepare_knowledge_publication") {
        return result({
          data: [
            {
              candidate_id: candidateId,
              article_id: articleId,
              version_id: versionId,
              previous_version_id: null,
            },
          ],
          error: null,
        });
      }
      if (name === "rollback_knowledge_candidate") {
        return result({
          data: [{ article_id: articleId, version_id: versionId }],
          error: null,
        });
      }
      return result({ data: null, error: null });
    });
    const from = vi.fn((table: string) =>
      result({
        data:
          table === "knowledge_reviews"
            ? {
                id: reviewId,
                candidate_id: candidateId,
                decision: "approve",
                notes: "Source verified",
                created_at: "2026-08-12T00:02:00.000Z",
              }
            : candidateRow,
        error: null,
      }),
    );
    const repository = createSupabaseKnowledgeOpsRepository({
      rpc,
      from,
    } as unknown as SupabaseClient);

    await expect(
      repository.saveDraft(candidateId, draft),
    ).resolves.toMatchObject({ id: candidateId, draft });
    await expect(
      repository.recordReview({
        candidateId,
        decision: "approve",
        notes: "Source verified",
        draft,
      }),
    ).resolves.toMatchObject({ id: reviewId, decision: "approve" });
    await expect(repository.preparePublication(candidateId)).resolves.toEqual({
      candidateId,
      articleId,
      versionId,
      previousVersionId: null,
    });
    await repository.publishVersion({
      candidateId,
      articleId,
      versionId,
      previousVersionId: null,
    });
    await expect(repository.rollbackPublication(candidateId)).resolves.toEqual({
      articleId,
      versionId,
    });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "save_knowledge_candidate_draft",
      "review_knowledge_candidate",
      "prepare_knowledge_publication",
      "publish_knowledge_candidate",
      "rollback_knowledge_candidate",
    ]);
  });

  it("normalizes provider failures without exposing database details", async () => {
    const client = {
      rpc: vi.fn(() =>
        result({ data: null, error: { message: "connection string leaked" } }),
      ),
      from: vi.fn(),
    } as unknown as SupabaseClient;

    await expect(
      createSupabaseKnowledgeOpsRepository(client).saveDraft(
        candidateId,
        draft,
      ),
    ).rejects.toMatchObject({
      code: "KNOWLEDGE_OPS_QUERY_FAILED",
      retryable: true,
    });
  });
});
