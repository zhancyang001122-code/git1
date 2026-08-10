import { z } from "zod";

import { AppError } from "@/lib/errors";

const databaseUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const isoDateTime = z.string().datetime({ offset: true });
const sourceSchema = z.enum([
  "housing_history_2024",
  "supabase_mock",
  "amap",
  "knowledge_base",
  "user_memory",
]);
const toolStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "timed_out",
]);

const progressSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  status: toolStatusSchema,
  source: sourceSchema,
  startedAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
});
const resultCardSchema = z.object({
  kind: z.enum(["house", "deal", "product", "place"]),
  data: z.record(z.string(), z.unknown()),
});
const citationSchema = z.object({
  articleId: databaseUuid,
  versionId: databaseUuid,
  chunkId: databaseUuid,
  title: z.string(),
  versionLabel: z.string(),
  effectiveFrom: z.string().nullable(),
  excerpt: z.string(),
  score: z.number().finite(),
  isDemo: z.boolean().optional(),
});
const debugRunSchema = progressSchema.extend({
  toolName: z.string().min(1),
  inputSummary: z.record(z.string(), z.unknown()),
  resultCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
});

const eventSchemas = {
  session: z.object({
    type: z.literal("session"),
    sessionId: databaseUuid,
    messageId: databaseUuid,
  }),
  assistant_delta: z.object({
    type: z.literal("assistant_delta"),
    delta: z.string(),
  }),
  tool_progress: z.object({
    type: z.literal("tool_progress"),
    progress: progressSchema,
  }),
  result_cards: z.object({
    type: z.literal("result_cards"),
    cards: z.array(resultCardSchema).max(20),
  }),
  citations: z.object({
    type: z.literal("citations"),
    citations: z.array(citationSchema).max(20),
  }),
  debug_tool_run: z.object({
    type: z.literal("debug_tool_run"),
    run: debugRunSchema,
  }),
  warning: z.object({
    type: z.literal("warning"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
  error: z.object({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
  done: z.object({
    type: z.literal("done"),
    finishReason: z.enum(["stop", "tool_limit", "fallback"]),
  }),
} as const;

export type PublicToolProgress = z.infer<typeof progressSchema>;
export type ResultCard = z.infer<typeof resultCardSchema>;
export type KnowledgeCitation = z.infer<typeof citationSchema>;
export type DebugToolRun = z.infer<typeof debugRunSchema>;
export type ChatStreamEvent = {
  [K in keyof typeof eventSchemas]: z.infer<(typeof eventSchemas)[K]>;
}[keyof typeof eventSchemas];
export type ChatEventType = ChatStreamEvent["type"];

export interface ChatStreamState {
  sessionId: string | null;
  messageId: string | null;
  assistantText: string;
  progress: Readonly<Record<string, PublicToolProgress>>;
  cards: readonly ResultCard[];
  citations: readonly KnowledgeCitation[];
  debugRuns: readonly DebugToolRun[];
  warnings: readonly { code: string; message: string }[];
  error: { code: string; message: string; retryable: boolean } | null;
  finishReason: "stop" | "tool_limit" | "fallback" | null;
}

export const initialChatStreamState: ChatStreamState = {
  sessionId: null,
  messageId: null,
  assistantText: "",
  progress: {},
  cards: [],
  citations: [],
  debugRuns: [],
  warnings: [],
  error: null,
  finishReason: null,
};

function mergeResultCards(
  current: readonly ResultCard[],
  incoming: readonly ResultCard[],
): ResultCard[] {
  const result = [...current];
  for (const card of incoming) {
    const id = card.data.id;
    const existingIndex =
      typeof id === "string"
        ? result.findIndex(
            (candidate) =>
              candidate.kind === card.kind && candidate.data.id === id,
          )
        : -1;
    if (existingIndex >= 0) result[existingIndex] = card;
    else result.push(card);
  }
  return result;
}

export function parseChatStreamEvent(
  type: string,
  payload: unknown,
): ChatStreamEvent {
  const schema = eventSchemas[type as keyof typeof eventSchemas];
  const result = schema?.safeParse({ type, ...(payload as object) });
  if (!result?.success) {
    throw new AppError({
      code: "SSE_PROTOCOL_INVALID",
      message: "聊天流事件格式无效",
      cause: result?.error,
    });
  }
  return result.data as ChatStreamEvent;
}

export function reduceChatStreamEvent(
  state: ChatStreamState,
  event: ChatStreamEvent,
): ChatStreamState {
  switch (event.type) {
    case "session":
      return {
        ...state,
        sessionId: event.sessionId,
        messageId: event.messageId,
      };
    case "assistant_delta":
      return { ...state, assistantText: state.assistantText + event.delta };
    case "tool_progress":
      return {
        ...state,
        progress: { ...state.progress, [event.progress.id]: event.progress },
      };
    case "result_cards":
      return { ...state, cards: mergeResultCards(state.cards, event.cards) };
    case "citations":
      return { ...state, citations: [...state.citations, ...event.citations] };
    case "debug_tool_run":
      return { ...state, debugRuns: [...state.debugRuns, event.run] };
    case "warning":
      return {
        ...state,
        warnings: [
          ...state.warnings,
          { code: event.code, message: event.message },
        ],
      };
    case "error":
      return {
        ...state,
        error: {
          code: event.code,
          message: event.message,
          retryable: event.retryable,
        },
      };
    case "done":
      return { ...state, finishReason: event.finishReason };
  }
}
