import type { z } from "zod";

import type {
  KnowledgeCitation,
  ResultCard,
} from "@/features/agent/chat-events";
import type { ToolContractDefinition } from "@/features/agent/tools/schemas";
import type { BusinessRepository } from "@/features/business/repository";
import type { MemoryRepository } from "@/features/memory/repository";
import type { MapsService } from "@/features/maps/types";
import type {
  KnowledgeCandidateSink,
  KnowledgeService,
} from "@/features/knowledge/types";

export type ToolSource =
  | "housing_history_2024"
  | "supabase_mock"
  | "amap"
  | "knowledge_base"
  | "user_memory";

export type ToolRunStatus =
  "queued" | "running" | "succeeded" | "failed" | "timed_out";

export interface ToolError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ToolError;
  source: ToolSource;
  cards?: readonly ResultCard[];
  citations?: readonly KnowledgeCitation[];
  resultCount: number;
}

export interface ToolAuditEntry {
  runId: string;
  sessionId: string;
  messageId: string;
  requestId: string;
  toolName: string;
  status: ToolRunStatus;
  inputSummary: Readonly<Record<string, unknown>>;
  outputSummary?: Readonly<Record<string, unknown>>;
  source: ToolSource;
  durationMs?: number;
  errorCode?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ToolAuditSink {
  record(entry: ToolAuditEntry): Promise<void>;
}

export interface ToolContext {
  business: BusinessRepository;
  maps: MapsService;
  knowledge: KnowledgeService;
  knowledgeCandidates?: KnowledgeCandidateSink;
  memory: MemoryRepository;
  audit: ToolAuditSink;
  businessSource: "housing_history_2024" | "supabase_mock";
  userId: string | null;
  sessionId: string;
  messageId: string;
  requestId: string;
  signal: AbortSignal;
}

export interface ToolExecution {
  callId: string;
  toolName: string;
  status: ToolRunStatus;
  result: ToolResult;
  inputSummary: Readonly<Record<string, unknown>>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  auditFailed: boolean;
}

export interface ToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends ToolContractDefinition {
  publicLabel: string;
  source(context: ToolContext): ToolSource;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;
}

export type ErasedToolDefinition = ToolDefinition<unknown, unknown>;
