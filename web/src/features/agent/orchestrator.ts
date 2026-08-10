import type { ChatStreamEvent } from "@/features/agent/chat-events";
import type {
  AIProvider,
  ProviderMessage,
  ProviderTurnInput,
} from "@/features/agent/provider";
import { AppError } from "@/lib/errors";

export interface ChatTurnCompletion {
  assistantText: string;
  finishReason: "stop" | "tool_limit" | "fallback";
  inputTokens?: number;
  outputTokens?: number;
}

interface OrchestrateChatTurnInput {
  sessionId: string;
  messageId: string;
  provider: AIProvider;
  messages: readonly ProviderMessage[];
  signal: AbortSignal;
  timeoutMs: number;
  onComplete?: (completion: ChatTurnCompletion) => Promise<void> | void;
}

function providerFailure(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError({
    code: "QWEN_PROVIDER_FAILED",
    message: "模型服务暂时不可用",
    retryable: true,
    cause: error,
  });
}

export async function* orchestrateChatTurn(
  input: OrchestrateChatTurnInput,
): AsyncIterable<ChatStreamEvent> {
  if (input.signal.aborted) {
    throw new AppError({
      code: "PROVIDER_ABORTED",
      message: "模型请求已取消",
      cause: input.signal.reason,
    });
  }

  yield {
    type: "session",
    sessionId: input.sessionId,
    messageId: input.messageId,
  };

  const requestController = new AbortController();
  let timedOut = false;
  const abortFromBrowser = () => requestController.abort(input.signal.reason);
  input.signal.addEventListener("abort", abortFromBrowser, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort(
      new AppError({
        code: "QWEN_PROVIDER_TIMEOUT",
        message: "模型响应超时，请重试",
        retryable: true,
      }),
    );
  }, input.timeoutMs);

  let assistantText = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let toolRequested = false;
  let finished = false;
  const providerInput: ProviderTurnInput = { messages: input.messages };

  try {
    for await (const event of input.provider.streamTurn(
      providerInput,
      requestController.signal,
    )) {
      if (event.type === "text_delta") {
        assistantText += event.delta;
        yield { type: "assistant_delta", delta: event.delta };
      } else if (event.type === "usage") {
        inputTokens = event.inputTokens ?? inputTokens;
        outputTokens = event.outputTokens ?? outputTokens;
      } else if (event.type === "tool_calls") {
        if (!toolRequested) {
          toolRequested = true;
          yield {
            type: "warning",
            code: "TOOLS_NOT_AVAILABLE",
            message: "当前阶段暂不执行外部工具，请稍后重试",
          };
        }
      } else if (event.type === "finish") {
        const finishReason = toolRequested ? "fallback" : "stop";
        if (input.onComplete) {
          try {
            await input.onComplete({
              assistantText,
              finishReason,
              ...(inputTokens !== undefined && { inputTokens }),
              ...(outputTokens !== undefined && { outputTokens }),
            });
          } catch (error) {
            yield {
              type: "warning",
              code: "CONVERSATION_PERSISTENCE_FAILED",
              message: "回答已生成，但对话记录暂未保存",
            };
            void error;
          }
        }
        yield { type: "done", finishReason };
        finished = true;
        break;
      }
    }

    if (!finished) {
      yield {
        type: "error",
        code: "QWEN_STREAM_INCOMPLETE",
        message: "模型响应未完整结束，请重试",
        retryable: true,
      };
    }
  } catch (error) {
    if (input.signal.aborted) {
      throw new AppError({
        code: "PROVIDER_ABORTED",
        message: "模型请求已取消",
        cause: input.signal.reason,
      });
    }
    if (timedOut) {
      yield {
        type: "error",
        code: "QWEN_PROVIDER_TIMEOUT",
        message: "模型响应超时，请重试",
        retryable: true,
      };
    } else {
      const normalized = providerFailure(error);
      if (normalized.code === "PROVIDER_ABORTED") throw normalized;
      yield {
        type: "error",
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
      };
    }
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener("abort", abortFromBrowser);
  }
}
