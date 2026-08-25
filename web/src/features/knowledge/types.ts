import type { KnowledgeCitation } from "@/features/agent/chat-events";

export const knowledgeDomains = [
  "housing",
  "group_buy",
  "market",
  "platform",
] as const;
export type KnowledgeDomain = (typeof knowledgeDomains)[number];
export type KnowledgeStatus =
  "draft" | "reviewing" | "published" | "archived" | "rejected";
export type KnowledgeMaterialKind =
  "demo" | "portfolio_first_party" | "public_official" | "external_authorized";
export type KnowledgeRankingStrategy =
  "demo" | "hybrid" | "hybrid_rerank" | "hybrid_rerank_fallback";

export interface KnowledgeSearchInput {
  query: string;
  domain: KnowledgeDomain | null;
  category: string | null;
  city: string | null;
  topK: number;
}

export interface KnowledgeQueryPlan {
  rewrittenQuery: string;
  domain?: KnowledgeDomain;
  category?: string;
  city?: string;
}

export interface HybridKnowledgeHit {
  chunkId: string;
  articleId: string;
  versionId: string;
  chunkIndex: number;
  title: string;
  versionLabel: string;
  sourceReference?: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  articleStatus: KnowledgeStatus;
  versionStatus: KnowledgeStatus;
  content: string;
  metadata: Readonly<Record<string, unknown>>;
  vectorScore: number;
  textScore: number;
  combinedScore: number;
  isDemo: boolean;
  materialKind?: KnowledgeMaterialKind;
}

export interface KnowledgeHit extends HybridKnowledgeHit {
  score: number;
}

export interface KnowledgeSearchResult {
  chunks: readonly KnowledgeHit[];
  citations: readonly KnowledgeCitation[];
  lowConfidence: boolean;
  conflict: boolean;
  queryPlan: KnowledgeQueryPlan;
  warnings: readonly string[];
  rankingStrategy: KnowledgeRankingStrategy;
  isDemo: boolean;
}

export interface KnowledgeVersionForIndex {
  articleId: string;
  versionId: string;
  title: string;
  versionLabel: string;
  contentMarkdown: string;
  domain: KnowledgeDomain;
  category: string;
  city: string | null;
  isDemo: boolean;
  materialKind?: KnowledgeMaterialKind;
  status: KnowledgeStatus;
}

export interface ChunkDraft {
  articleId: string;
  versionId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  headingPath: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface StoredKnowledgeChunk {
  chunkIndex: number;
  contentHash: string | null;
  embeddingStatus: "pending" | "processing" | "ready" | "failed";
}

export interface IndexedKnowledgeChunk extends ChunkDraft {
  embedding: readonly number[];
  embeddingModel: string;
}

export interface IndexResult {
  versionId: string;
  totalChunks: number;
  indexedChunks: number;
  skippedChunks: number;
  status: "ready";
}

export interface EmbeddingProvider {
  embed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]>;
}

export interface RerankResult {
  index: number;
  score: number;
}

export interface KnowledgeReranker {
  rerank(
    query: string,
    documents: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly RerankResult[]>;
}

export interface HybridSearchRequest {
  queryText: string;
  queryEmbedding: readonly number[];
  domain?: KnowledgeDomain;
  category?: string;
  city?: string;
  matchCount: number;
  vectorWeight: number;
  textWeight: number;
}

export interface KnowledgeRepository {
  hybridSearch(
    input: HybridSearchRequest,
    signal?: AbortSignal,
  ): Promise<HybridKnowledgeHit[]>;
  getVersionForIndex(
    versionId: string,
    signal?: AbortSignal,
  ): Promise<KnowledgeVersionForIndex | null>;
  listChunksForVersion(
    versionId: string,
    signal?: AbortSignal,
  ): Promise<StoredKnowledgeChunk[]>;
  upsertChunks(
    chunks: readonly IndexedKnowledgeChunk[],
    signal?: AbortSignal,
  ): Promise<void>;
  deleteChunksNotIn(
    versionId: string,
    retainedChunkIndexes: readonly number[],
    signal?: AbortSignal,
  ): Promise<void>;
  markChunksFailed(
    versionId: string,
    chunkIndexes: readonly number[],
    signal?: AbortSignal,
  ): Promise<void>;
}

export interface KnowledgeService {
  search(
    input: KnowledgeSearchInput,
    signal?: AbortSignal,
  ): Promise<KnowledgeSearchResult>;
  indexVersion(versionId: string, signal?: AbortSignal): Promise<IndexResult>;
}

export interface KnowledgeCandidateInput {
  sourceType:
    | "low_confidence"
    | "no_result"
    | "user_feedback"
    | "repeated_question"
    | "human_correction";
  sessionId: string;
  messageId: string;
  question: string;
  domain: KnowledgeDomain | null;
  reason: string;
  evidence: readonly KnowledgeCitation[];
}

export interface KnowledgeCandidateSink {
  enqueue(
    input: KnowledgeCandidateInput,
    signal?: AbortSignal,
  ): Promise<{ candidateId: string }>;
}
