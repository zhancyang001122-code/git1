export type ProviderMessageRole = "system" | "user" | "assistant" | "tool";

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ProviderMessage {
  role: ProviderMessageRole;
  content: string;
  toolCallId?: string;
  toolCalls?: readonly ProviderToolCall[];
}

export interface ProviderToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

export interface ProviderToolChoice {
  name: string;
}

export interface ProviderTurnInput {
  messages: readonly ProviderMessage[];
  tools?: readonly ProviderToolDefinition[];
  toolChoice?: ProviderToolChoice;
}

export type ProviderEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_calls"; calls: readonly ProviderToolCall[] }
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "warning"; code: string; message: string }
  | { type: "finish"; reason: string };

export interface AIProvider {
  streamTurn(
    input: ProviderTurnInput,
    signal: AbortSignal,
  ): AsyncIterable<ProviderEvent>;
}
