import { describe, expect, it, vi } from "vitest";

import { QwenEmbeddingProvider } from "@/features/knowledge/qwen-embedding-provider";

const vector = (length = 1024) =>
  Array.from({ length }, (_item, index) => index / 1024);

describe("QwenEmbeddingProvider", () => {
  it("batches at ten items and requests exactly 1024 dimensions", async () => {
    const create = vi.fn(async (request: { input: string[] }) => ({
      data: request.input.map((_text, index) => ({
        index,
        embedding: vector(),
      })),
    }));
    const provider = new QwenEmbeddingProvider({
      client: { embeddings: { create } },
      model: "text-embedding-v4",
      dimensions: 1024,
    });

    const result = await provider.embed(
      Array.from({ length: 11 }, (_item, index) => `文本 ${index}`),
    );

    expect(result).toHaveLength(11);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: "text-embedding-v4",
      dimensions: 1024,
    });
  });

  it("rejects a wrong-length or non-finite vector", async () => {
    const provider = new QwenEmbeddingProvider({
      client: {
        embeddings: {
          create: vi.fn(async () => ({
            data: [{ index: 0, embedding: [...vector(1023), Number.NaN] }],
          })),
        },
      },
      model: "text-embedding-v4",
      dimensions: 1024,
    });

    await expect(provider.embed(["退款规则"])).rejects.toMatchObject({
      code: "EMBEDDING_INVALID_RESPONSE",
    });
  });

  it("retries one transient embedding failure", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: vector() }] });
    const provider = new QwenEmbeddingProvider({
      client: { embeddings: { create } },
      model: "text-embedding-v4",
      dimensions: 1024,
      retryJitterMs: () => 0,
    });

    await expect(provider.embed(["退款规则"])).resolves.toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
