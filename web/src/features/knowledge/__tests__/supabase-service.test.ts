import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseKnowledgeRepository } from "@/features/knowledge/supabase-service";

function thenableResult<T>(value: T) {
  const builder = {
    abortSignal: vi.fn(() => builder),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
  return builder;
}

const request = {
  queryText: "退款规则",
  queryEmbedding: Array(1024).fill(0.01),
  domain: "group_buy" as const,
  category: "refund",
  city: "杭州",
  matchCount: 12,
  vectorWeight: 0.65,
  textWeight: 0.35,
};

describe("Supabase knowledge repository", () => {
  it("passes the abort signal and maps evidence-rich hybrid rows", async () => {
    const query = thenableResult({
      data: [
        {
          chunk_id: "63000000-0000-4000-8000-000000000001",
          article_id: "61000000-0000-4000-8000-000000000001",
          version_id: "62000000-0000-4000-8000-000000000001",
          chunk_index: 0,
          title: "团购券退款规则",
          version_label: "v1.0",
          effective_from: "2026-08-01",
          effective_until: null,
          article_status: "published",
          version_status: "published",
          content: "未使用且有效期内的可退团购券可以申请退款。",
          metadata: {},
          vector_score: 0.8,
          text_score: 0.7,
          combined_score: 0.765,
          is_demo: false,
        },
      ],
      error: null,
    });
    const rpc = vi.fn(() => query);
    const client = { rpc } as unknown as SupabaseClient;
    const controller = new AbortController();

    const result = await createSupabaseKnowledgeRepository(client).hybridSearch(
      request,
      controller.signal,
    );

    expect(query.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(rpc).toHaveBeenCalledWith(
      "hybrid_search_kb_v2",
      expect.objectContaining({
        p_query_text: "退款规则",
        p_match_count: 12,
        p_vector_weight: 0.65,
        p_text_weight: 0.35,
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        title: "团购券退款规则",
        articleStatus: "published",
        effectiveUntil: null,
        isDemo: false,
      }),
    ]);
  });

  it("normalizes invalid database rows into a stable application error", async () => {
    const query = thenableResult({
      data: [{ chunk_id: "invalid" }],
      error: null,
    });
    const client = { rpc: vi.fn(() => query) } as unknown as SupabaseClient;

    await expect(
      createSupabaseKnowledgeRepository(client).hybridSearch(request),
    ).rejects.toMatchObject({
      code: "KNOWLEDGE_SEARCH_INVALID_RESPONSE",
      retryable: true,
    });
  });
});
