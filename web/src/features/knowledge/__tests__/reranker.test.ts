import { describe, expect, it, vi } from "vitest";

import { QwenReranker } from "@/features/knowledge/qwen-reranker";

describe("QwenReranker", () => {
  it("returns validated original indexes and relevance scores", async () => {
    const post = vi.fn(async () => ({
      results: [
        { index: 1, relevance_score: 0.93 },
        { index: 0, relevance_score: 0.61 },
      ],
    }));
    const reranker = new QwenReranker({
      client: { post },
      model: "qwen3-rerank",
    });

    await expect(
      reranker.rerank("退款条件", ["文档一", "文档二"]),
    ).resolves.toEqual([
      { index: 1, score: 0.93 },
      { index: 0, score: 0.61 },
    ]);
    expect(post).toHaveBeenCalledWith(
      "/reranks",
      expect.objectContaining({ body: expect.objectContaining({ top_n: 2 }) }),
      expect.anything(),
    );
  });

  it("rejects duplicate or out-of-range indexes", async () => {
    const reranker = new QwenReranker({
      client: {
        post: vi.fn(async () => ({
          results: [
            { index: 2, relevance_score: 0.9 },
            { index: 2, relevance_score: 0.8 },
          ],
        })),
      },
      model: "qwen3-rerank",
    });

    await expect(
      reranker.rerank("退款条件", ["一", "二"]),
    ).rejects.toMatchObject({
      code: "RERANK_INVALID_RESPONSE",
    });
  });

  it("rejects partial or unsorted responses instead of dropping candidates", async () => {
    const partial = new QwenReranker({
      client: {
        post: vi.fn(async () => ({
          results: [{ index: 0, relevance_score: 0.9 }],
        })),
      },
      model: "qwen3-rerank",
    });
    const unsorted = new QwenReranker({
      client: {
        post: vi.fn(async () => ({
          results: [
            { index: 0, relevance_score: 0.4 },
            { index: 1, relevance_score: 0.8 },
          ],
        })),
      },
      model: "qwen3-rerank",
    });

    await expect(
      partial.rerank("退款", ["规则一", "规则二"]),
    ).rejects.toMatchObject({ code: "RERANK_INVALID_RESPONSE" });
    await expect(
      unsorted.rerank("退款", ["规则一", "规则二"]),
    ).rejects.toMatchObject({ code: "RERANK_INVALID_RESPONSE" });
  });

  it("retries one transient rerank failure", async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({
        results: [{ index: 0, relevance_score: 0.8 }],
      });
    const reranker = new QwenReranker({
      client: { post },
      model: "qwen3-rerank",
      retryJitterMs: () => 0,
    });

    await expect(reranker.rerank("退款", ["规则"])).resolves.toEqual([
      { index: 0, score: 0.8 },
    ]);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
