import "server-only";

import { z } from "zod";

import type { EmbeddingProvider } from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";
import { logger, type LogContext } from "@/lib/logger";
import {
  createCircuitBreaker,
  retryTransient,
  type CircuitBreaker,
} from "@/lib/resilience";

const sharedEmbeddingCircuitBreaker = createCircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 30_000,
});

export interface EmbeddingClient {
  embeddings: {
    create(
      request: {
        model: string;
        input: string[];
        dimensions: number;
        encoding_format: "float";
      },
      options?: { signal?: AbortSignal },
    ): Promise<unknown>;
  };
}

export interface QwenEmbeddingProviderOptions {
  client: EmbeddingClient;
  model: string;
  dimensions: number;
  circuitBreaker?: CircuitBreaker;
  retryJitterMs?: () => number;
  warn?: EmbeddingWarningWriter;
}

interface UpstreamDiagnostic {
  upstreamStatus?: number;
  upstreamCode?: string;
  upstreamType?: string;
  upstreamRequestId?: string;
  upstreamErrorClass?: string;
}

interface EmbeddingWarningContext extends LogContext, UpstreamDiagnostic {
  requestId: string;
  errorCode: "EMBEDDING_FAILED";
}

type EmbeddingWarningWriter = (
  event: string,
  context: EmbeddingWarningContext,
) => void;

const safeDiagnosticToken = /^[A-Za-z0-9._:-]{1,160}$/;

function diagnosticToken(value: unknown): string | undefined {
  return typeof value === "string" && safeDiagnosticToken.test(value)
    ? value
    : undefined;
}

function upstreamDiagnostic(error: unknown): UpstreamDiagnostic {
  if (!error || typeof error !== "object") return {};
  const record = error as Record<string, unknown>;
  const constructorName = diagnosticToken(
    (error as { constructor?: { name?: unknown } }).constructor?.name,
  );
  const status = record.status;
  const code = diagnosticToken(record.code);
  const type = diagnosticToken(record.type);
  const requestId = diagnosticToken(record.requestID ?? record.request_id);
  return {
    ...(typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599 && { upstreamStatus: status }),
    ...(code && { upstreamCode: code }),
    ...(type && { upstreamType: type }),
    ...(requestId && { upstreamRequestId: requestId }),
    ...(constructorName && { upstreamErrorClass: constructorName }),
  };
}

const responseSchema = z.object({
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number().finite()),
    }),
  ),
});

export class QwenEmbeddingProvider implements EmbeddingProvider {
  private readonly client: EmbeddingClient;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryJitterMs?: () => number;
  private readonly warn: EmbeddingWarningWriter;

  constructor(options: QwenEmbeddingProviderOptions) {
    this.client = options.client;
    this.model = options.model;
    this.dimensions = options.dimensions;
    this.circuitBreaker =
      options.circuitBreaker ?? sharedEmbeddingCircuitBreaker;
    this.retryJitterMs = options.retryJitterMs;
    this.warn = options.warn ?? logger.warn;
  }

  async embed(
    texts: readonly string[],
    signal?: AbortSignal,
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    const embeddings: number[][] = [];
    try {
      for (let offset = 0; offset < texts.length; offset += 10) {
        signal?.throwIfAborted();
        const batch = texts.slice(offset, offset + 10);
        const raw = await this.circuitBreaker.execute(() =>
          retryTransient(
            async () => {
              try {
                return await this.client.embeddings.create(
                  {
                    model: this.model,
                    input: [...batch],
                    dimensions: this.dimensions,
                    encoding_format: "float",
                  },
                  { signal },
                );
              } catch (error) {
                throw new AppError({
                  code: "EMBEDDING_FAILED",
                  message: "Embedding 服务暂时不可用",
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
        const parsed = responseSchema.safeParse(raw);
        if (!parsed.success || parsed.data.data.length !== batch.length) {
          throw new AppError({
            code: "EMBEDDING_INVALID_RESPONSE",
            message: "Embedding 服务返回格式无效",
            retryable: true,
            cause: parsed.error,
          });
        }
        const ordered = [...parsed.data.data].sort(
          (left, right) => left.index - right.index,
        );
        if (
          ordered.some(
            (item, index) =>
              item.index !== index || item.embedding.length !== this.dimensions,
          )
        ) {
          throw new AppError({
            code: "EMBEDDING_INVALID_RESPONSE",
            message: `Embedding 向量必须为 ${this.dimensions} 维`,
            retryable: true,
          });
        }
        embeddings.push(...ordered.map((item) => item.embedding));
      }
      return embeddings;
    } catch (error) {
      const normalizedError =
        error instanceof AppError
          ? error
          : new AppError({
              code: "EMBEDDING_FAILED",
              message: "Embedding 服务暂时不可用",
              retryable: true,
              cause: error,
            });
      if (normalizedError.code === "EMBEDDING_FAILED") {
        const diagnostic = upstreamDiagnostic(normalizedError.cause);
        this.warn("embedding.upstream_failed", {
          requestId: crypto.randomUUID(),
          errorCode: "EMBEDDING_FAILED",
          ...diagnostic,
        });
      }
      throw normalizedError;
    }
  }
}
