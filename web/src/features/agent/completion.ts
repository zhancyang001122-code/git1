import type {
  KnowledgeCitation,
  ResultCard,
} from "@/features/agent/chat-events";

export interface ChatTurnCompletion {
  assistantText: string;
  finishReason: "stop" | "tool_limit" | "fallback";
  inputTokens?: number;
  outputTokens?: number;
  firstTokenMs?: number;
  usageRounds?: readonly {
    inputTokens: number;
    outputTokens: number;
  }[];
  cards?: readonly ResultCard[];
  citations?: readonly KnowledgeCitation[];
}
