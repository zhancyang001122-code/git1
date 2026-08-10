import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseKnowledgeCandidateSink,
  normalizeCandidateQuestion,
} from "@/features/knowledge/candidate-sink";

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

describe("knowledge candidate sink", () => {
  it("normalizes whitespace and removes common contact identifiers", () => {
    expect(
      normalizeCandidateQuestion(
        "  请联系 13812345678 或 test@example.com 处理退款  ",
      ),
    ).toBe("请联系 [手机号] 或 [邮箱] 处理退款");
  });

  it("enqueues only a redacted question through the server RPC", async () => {
    const query = thenableResult({
      data: "64000000-0000-4000-8000-000000000001",
      error: null,
    });
    const rpc = vi.fn(() => query);
    const sink = createSupabaseKnowledgeCandidateSink({
      rpc,
    } as unknown as SupabaseClient);
    const controller = new AbortController();

    const result = await sink.enqueue(
      {
        sourceType: "no_result",
        sessionId: "71000000-0000-4000-8000-000000000001",
        messageId: "72000000-0000-4000-8000-000000000001",
        question: "手机号 13812345678 的退款政策是什么",
        domain: "group_buy",
        reason: "no_effective_evidence",
        evidence: [],
      },
      controller.signal,
    );

    expect(result.candidateId).toBe("64000000-0000-4000-8000-000000000001");
    expect(query.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(rpc).toHaveBeenCalledWith(
      "enqueue_knowledge_candidate",
      expect.objectContaining({
        p_normalized_question: "手机号 [手机号] 的退款政策是什么",
        p_source_type: "no_result",
      }),
    );
  });
});
