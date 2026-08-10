import "server-only";

import { z } from "zod";

import type {
  KnowledgeReranker,
  RerankResult,
} from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";

export interface RerankClient {
  post(
    path: string,
    options: { body: Record<string, unknown> },
    requestOptions?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

export interface QwenRerankerOptions {
  client: RerankClient;
  model: string;
}

const responseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      relevance_score: z.number().finite().min(0).max(1),
    }),
  ),
});

export class QwenReranker implements KnowledgeReranker {
  private readonly client: RerankClient;
  private readonly model: string;

  constructor(options: QwenRerankerOptions) {
    this.client = options.client;
    this.model = options.model;
  }

  async rerank(
    query: string,
    documents: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly RerankResult[]> {
    if (documents.length === 0) return [];
    let raw: unknown;
    try {
      raw = await this.client.post(
        "/reranks",
        {
          body: {
            model: this.model,
            query,
            documents: [...documents],
            top_n: documents.length,
            instruct:
              "Given a customer service question, retrieve passages that directly answer it.",
          },
        },
        { signal },
      );
    } catch (error) {
      throw new AppError({
        code: "RERANK_FAILED",
        message: "重排服务暂时不可用",
        retryable: true,
        cause: error,
      });
    }
    const parsed = responseSchema.safeParse(raw);
    const indexes = parsed.success
      ? parsed.data.results.map((item) => item.index)
      : [];
    if (
      !parsed.success ||
      new Set(indexes).size !== indexes.length ||
      indexes.some((index) => index >= documents.length)
    ) {
      throw new AppError({
        code: "RERANK_INVALID_RESPONSE",
        message: "重排服务返回格式无效",
        retryable: true,
        cause: parsed.error,
      });
    }
    return parsed.data.results.map((item) => ({
      index: item.index,
      score: item.relevance_score,
    }));
  }
}
