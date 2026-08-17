import type {
  AIProvider,
  ProviderEvent,
  ProviderTurnInput,
} from "@/features/agent/provider";

export const QWEN_RULE_FALLBACK = "QWEN_RULE_FALLBACK";

const fallbackMessage =
  "千问服务暂时不可用，已切换为规则化工具查询；实时事实仍只采用工具结果。";

interface ResilientAIProviderOptions {
  primary: AIProvider;
  fallback: AIProvider;
}

export class ResilientAIProvider implements AIProvider {
  private readonly primary: AIProvider;
  private readonly fallback: AIProvider;
  private degraded = false;

  constructor(options: ResilientAIProviderOptions) {
    this.primary = options.primary;
    this.fallback = options.fallback;
  }

  async *streamTurn(
    input: ProviderTurnInput,
    signal: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    signal.throwIfAborted();
    if (this.degraded) {
      yield* this.fallback.streamTurn(input, signal);
      return;
    }

    let emitted = false;
    try {
      for await (const event of this.primary.streamTurn(input, signal)) {
        emitted = true;
        yield event;
      }
      return;
    } catch (error) {
      if (signal.aborted || emitted) throw error;
    }

    this.degraded = true;
    yield {
      type: "warning",
      code: QWEN_RULE_FALLBACK,
      message: fallbackMessage,
    };
    yield* this.fallback.streamTurn(input, signal);
  }
}
