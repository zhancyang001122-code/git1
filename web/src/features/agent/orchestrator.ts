import type { ChatStreamEvent } from "@/features/agent/chat-events";
import type { ChatTurnCompletion } from "@/features/agent/completion";
import type {
  AIProvider,
  ProviderMessage,
  ProviderToolChoice,
} from "@/features/agent/provider";
import { runAgentToolLoop } from "@/features/agent/tool-loop";
import type { ToolExecutor } from "@/features/agent/tools/executor";
import type { ToolContext } from "@/features/agent/tools/types";
import { AppError } from "@/lib/errors";

export type { ChatTurnCompletion } from "@/features/agent/completion";

interface OrchestrateChatTurnInput {
  sessionId: string;
  messageId: string;
  provider: AIProvider;
  messages: readonly ProviderMessage[];
  signal: AbortSignal;
  timeoutMs: number;
  toolExecutor?: ToolExecutor;
  toolContext?: ToolContext;
  debug?: boolean;
  maxToolRounds?: number;
  initialToolChoice?: ProviderToolChoice;
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

  try {
    for await (const event of runAgentToolLoop({
      provider: input.provider,
      messages: input.messages,
      signal: requestController.signal,
      ...(input.toolExecutor && { executor: input.toolExecutor }),
      ...(input.toolContext && {
        toolContext: {
          ...input.toolContext,
          signal: requestController.signal,
        },
      }),
      debug: input.debug ?? false,
      maxRounds: input.maxToolRounds ?? 8,
      ...(input.initialToolChoice && {
        initialToolChoice: input.initialToolChoice,
      }),
      onComplete: input.onComplete,
    })) {
      yield event;
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
