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

  it("logs only allowlisted upstream diagnostics after retries are exhausted", async () => {
    const upstreamError = Object.assign(
      new Error("401 api-key=sk-sensitive input=private-customer-question"),
      {
        status: 401,
        code: "InvalidApiKey",
        type: "authentication_error",
        requestID: "req-safe-123",
        headers: { authorization: "Bearer sk-sensitive" },
        error: { message: "private-customer-question" },
      },
    );
    const create = vi.fn().mockRejectedValue(upstreamError);
    const warn = vi.fn();
    const provider = new QwenEmbeddingProvider({
      client: { embeddings: { create } },
      model: "text-embedding-v4",
      dimensions: 1024,
      retryJitterMs: () => 0,
      warn,
    });

    await expect(
      provider.embed(["private-customer-question"]),
    ).rejects.toMatchObject({ code: "EMBEDDING_FAILED" });

    expect(create).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("embedding.upstream_failed", {
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      errorCode: "EMBEDDING_FAILED",
      upstreamStatus: 401,
      upstreamCode: "InvalidApiKey",
      upstreamType: "authentication_error",
      upstreamRequestId: "req-safe-123",
      upstreamErrorClass: "Error",
    });
    const serializedLog = JSON.stringify(warn.mock.calls);
    expect(serializedLog).not.toContain("sk-sensitive");
    expect(serializedLog).not.toContain("private-customer-question");
    expect(serializedLog).not.toContain("authorization");
  });
});
