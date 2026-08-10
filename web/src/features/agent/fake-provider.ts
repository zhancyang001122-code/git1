import type {
  AIProvider,
  ProviderEvent,
  ProviderTurnInput,
} from "@/features/agent/provider";
import { AppError } from "@/lib/errors";

interface FailureFixture {
  code: string;
  retryable: boolean;
}

export class FakeAIProvider implements AIProvider {
  readonly turns: ProviderTurnInput[] = [];

  constructor(
    private readonly events: readonly ProviderEvent[],
    private readonly failure?: FailureFixture,
  ) {}

  static failing(code: string, retryable = false): FakeAIProvider {
    return new FakeAIProvider([], { code, retryable });
  }

  async *streamTurn(
    input: ProviderTurnInput,
    signal: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    this.turns.push(input);
    this.assertNotAborted(signal);

    if (this.failure) {
      throw new AppError({
        code: this.failure.code,
        message: "模型服务暂时不可用",
        retryable: this.failure.retryable,
      });
    }

    for (const event of this.events) {
      this.assertNotAborted(signal);
      yield event;
    }
  }

  private assertNotAborted(signal: AbortSignal) {
    if (signal.aborted) {
      throw new AppError({
        code: "PROVIDER_ABORTED",
        message: "模型请求已取消",
        cause: signal.reason,
      });
    }
  }
}
