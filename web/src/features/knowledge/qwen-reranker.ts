import "server-only";

import { z } from "zod";

import type {
  KnowledgeReranker,
  RerankResult,
} from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";
import {
  createCircuitBreaker,
  retryTransient,
  type CircuitBreaker,
} from "@/lib/resilience";

const sharedRerankCircuitBreaker = createCircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 30_000,
});

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
  circuitBreaker?: CircuitBreaker;
  retryJitterMs?: () => number;
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
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryJitterMs?: () => number;

  constructor(options: QwenRerankerOptions) {
    this.client = options.client;
    this.model = options.model;
    this.circuitBreaker = options.circuitBreaker ?? sharedRerankCircuitBreaker;
    this.retryJitterMs = options.retryJitterMs;
  }

  async rerank(
    query: string,
    documents: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly RerankResult[]> {
    if (documents.length === 0) return [];
    let raw: unknown;
    try {
      raw = await this.circuitBreaker.execute(() =>
        retryTransient(
          async () => {
            try {
              return await this.client.post(
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
          },
          {
            retries: 1,
            ...(this.retryJitterMs && { jitterMs: this.retryJitterMs }),
          },
        ),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
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
    const sortedDescending = parsed.success
      ? parsed.data.results.every(
          (item, index, results) =>
            index === 0 ||
            results[index - 1]!.relevance_score >= item.relevance_score,
        )
      : false;
    if (
      !parsed.success ||
      indexes.length !== documents.length ||
      new Set(indexes).size !== indexes.length ||
      indexes.some((index) => index >= documents.length) ||
      !sortedDescending
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
