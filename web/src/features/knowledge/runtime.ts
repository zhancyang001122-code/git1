import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import { FakeKnowledgeService } from "@/features/knowledge/fake-service";
import {
  QwenEmbeddingProvider,
  type EmbeddingClient,
} from "@/features/knowledge/qwen-embedding-provider";
import {
  QwenReranker,
  type RerankClient,
} from "@/features/knowledge/qwen-reranker";
import { DefaultKnowledgeService } from "@/features/knowledge/service";
import { createSupabaseKnowledgeRepository } from "@/features/knowledge/supabase-service";
import type { KnowledgeService } from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";
import {
  parsePublicEnv,
  parseServerEnv,
  type EnvironmentInput,
} from "@/lib/env";

interface KnowledgeRuntimeOptions {
  environment?: EnvironmentInput;
  supabase?: SupabaseClient;
}

export interface KnowledgeRuntime {
  mode: "demo" | "live";
  service: KnowledgeService;
}

export function createKnowledgeRuntime(
  options: KnowledgeRuntimeOptions = {},
): KnowledgeRuntime {
  const environment = options.environment ?? process.env;
  const publicConfiguration = parsePublicEnv(environment);
  const serverConfiguration = parseServerEnv(environment);
  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return { mode: "demo", service: new FakeKnowledgeService() };
  }
  if (!options.supabase || !serverConfiguration.DASHSCOPE_API_KEY) {
    throw new AppError({
      code: "KNOWLEDGE_NOT_CONFIGURED",
      message: "知识库服务尚未完整配置",
      status: 503,
      retryable: true,
    });
  }
  const embeddingClient = new OpenAI({
    apiKey: serverConfiguration.DASHSCOPE_API_KEY,
    baseURL: serverConfiguration.DASHSCOPE_BASE_URL,
    timeout: serverConfiguration.AI_REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  const embedding = new QwenEmbeddingProvider({
    client: embeddingClient as unknown as EmbeddingClient,
    model: serverConfiguration.DASHSCOPE_EMBEDDING_MODEL,
    dimensions: serverConfiguration.DASHSCOPE_EMBEDDING_DIMENSIONS,
  });
  let reranker: QwenReranker | undefined;
  if (
    serverConfiguration.RAG_RERANK_ENABLED &&
    serverConfiguration.DASHSCOPE_RERANK_BASE_URL
  ) {
    const rerankClient = new OpenAI({
      apiKey: serverConfiguration.DASHSCOPE_API_KEY,
      baseURL: serverConfiguration.DASHSCOPE_RERANK_BASE_URL,
      timeout: serverConfiguration.TOOL_TIMEOUT_MS,
      maxRetries: 0,
    });
    reranker = new QwenReranker({
      client: rerankClient as unknown as RerankClient,
      model: serverConfiguration.DASHSCOPE_RERANK_MODEL,
    });
  }
  return {
    mode: "live",
    service: new DefaultKnowledgeService({
      repository: createSupabaseKnowledgeRepository(options.supabase),
      embedding,
      ...(reranker && { reranker }),
      embeddingModel: serverConfiguration.DASHSCOPE_EMBEDDING_MODEL,
      lowConfidenceThreshold: serverConfiguration.RAG_LOW_CONFIDENCE_THRESHOLD,
      vectorWeight: serverConfiguration.RAG_VECTOR_WEIGHT,
      textWeight: serverConfiguration.RAG_TEXT_WEIGHT,
      recallCount: serverConfiguration.RAG_TOP_K,
      finalCount: serverConfiguration.RAG_FINAL_K,
    }),
  };
}

export async function createRequestKnowledgeService(
  environment: EnvironmentInput = process.env,
): Promise<KnowledgeService> {
  const publicConfiguration = parsePublicEnv(environment);
  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return createKnowledgeRuntime({ environment }).service;
  }
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  return createKnowledgeRuntime({
    environment,
    supabase: createAdminSupabaseClient(),
  }).service;
}
