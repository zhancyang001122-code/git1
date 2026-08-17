import "server-only";

import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { z } from "zod";

import type {
  AIProvider,
  ProviderEvent,
  ProviderMessage,
  ProviderToolCall,
  ProviderTurnInput,
} from "@/features/agent/provider";
import { AppError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";
import {
  createCircuitBreaker,
  retryTransient,
  type CircuitBreaker,
} from "@/lib/resilience";

const sharedQwenCircuitBreaker = createCircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 30_000,
});

const chunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              index: z.number().int().nonnegative(),
              id: z.string().nullish(),
              function: z
                .object({
                  name: z.string().nullish(),
                  arguments: z.string().nullish(),
                })
                .nullish(),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .nullable()
    .optional(),
});

export interface QwenStreamRequest {
  model: string;
  stream: true;
  stream_options: { include_usage: true };
  messages: readonly Record<string, unknown>[];
  tools?: readonly Record<string, unknown>[];
  tool_choice?: {
    type: "function";
    function: { name: string };
  };
}

export type QwenStreamFactory = (
  request: QwenStreamRequest,
  signal: AbortSignal,
) => Promise<AsyncIterable<unknown>>;

interface QwenProviderOptions {
  model: string;
  streamFactory: QwenStreamFactory;
  circuitBreaker?: CircuitBreaker;
  retryJitterMs?: () => number;
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

function providerMessage(message: ProviderMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

function completedCalls(
  calls: Map<number, ToolCallAccumulator>,
): ProviderToolCall[] {
  return [...calls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, call]) => ({ ...call }));
}

function normalizedError(error: unknown, signal: AbortSignal): AppError {
  if (
    signal.aborted ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return new AppError({
      code: "PROVIDER_ABORTED",
      message: "模型请求已取消",
      cause: error,
    });
  }
  return new AppError({
    code: "QWEN_PROVIDER_FAILED",
    message: "模型服务暂时不可用",
    retryable: true,
    cause: error,
  });
}

export class QwenProvider implements AIProvider {
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly options: QwenProviderOptions) {
    this.circuitBreaker = options.circuitBreaker ?? sharedQwenCircuitBreaker;
  }

  async *streamTurn(
    input: ProviderTurnInput,
    signal: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    const toolCalls = new Map<number, ToolCallAccumulator>();
    const request: QwenStreamRequest = {
      model: this.options.model,
      stream: true,
      stream_options: { include_usage: true },
      messages: input.messages.map(providerMessage),
      ...(input.tools?.length && {
        tools: input.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            ...(tool.strict !== undefined && { strict: tool.strict }),
          },
        })),
      }),
      ...(input.toolChoice && {
        tool_choice: {
          type: "function" as const,
          function: { name: input.toolChoice.name },
        },
      }),
    };

    try {
      signal.throwIfAborted();
      const stream = await this.circuitBreaker.execute(() =>
        retryTransient(
          async () => {
            try {
              return await this.options.streamFactory(request, signal);
            } catch (error) {
              throw normalizedError(error, signal);
            }
          },
          {
            retries: 1,
            ...(this.options.retryJitterMs && {
              jitterMs: this.options.retryJitterMs,
            }),
          },
        ),
      );
      for await (const rawChunk of stream) {
        signal.throwIfAborted();
        const parsed = chunkSchema.safeParse(rawChunk);
        if (!parsed.success) {
          throw new AppError({
            code: "QWEN_RESPONSE_INVALID",
            message: "模型响应格式无效",
            cause: parsed.error,
          });
        }
        const chunk = parsed.data;
        for (const choice of chunk.choices) {
          if (choice.delta.content) {
            yield { type: "text_delta", delta: choice.delta.content };
          }
          for (const fragment of choice.delta.tool_calls ?? []) {
            const current = toolCalls.get(fragment.index) ?? {
              id: "",
              name: "",
              arguments: "",
            };
            if (fragment.id) current.id += fragment.id;
            if (fragment.function?.name) current.name += fragment.function.name;
            if (fragment.function?.arguments)
              current.arguments += fragment.function.arguments;
            toolCalls.set(fragment.index, current);
          }
        }
        if (chunk.usage) {
          yield {
            type: "usage",
            ...(chunk.usage.prompt_tokens !== undefined && {
              inputTokens: chunk.usage.prompt_tokens,
            }),
            ...(chunk.usage.completion_tokens !== undefined && {
              outputTokens: chunk.usage.completion_tokens,
            }),
          };
        }
        for (const choice of chunk.choices) {
          if (!choice.finish_reason) continue;
          if (toolCalls.size > 0) {
            yield { type: "tool_calls", calls: completedCalls(toolCalls) };
            toolCalls.clear();
          }
          yield { type: "finish", reason: choice.finish_reason };
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw normalizedError(error, signal);
    }
  }
}

export function createQwenProvider(): QwenProvider {
  const environment = serverEnv();
  if (!environment.DASHSCOPE_API_KEY) {
    throw new AppError({
      code: "QWEN_NOT_CONFIGURED",
      message: "千问模型尚未配置",
    });
  }
  const client = new OpenAI({
    apiKey: environment.DASHSCOPE_API_KEY,
    baseURL: environment.DASHSCOPE_BASE_URL,
  });
  const streamFactory: QwenStreamFactory = async (request, signal) =>
    client.chat.completions.create(
      request as unknown as ChatCompletionCreateParamsStreaming,
      { signal },
    );
  return new QwenProvider({
    model: environment.DASHSCOPE_MODEL,
    streamFactory,
  });
}
