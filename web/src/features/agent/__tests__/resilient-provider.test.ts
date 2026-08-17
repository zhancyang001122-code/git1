import { describe, expect, it, vi } from "vitest";

import type {
  AIProvider,
  ProviderEvent,
  ProviderTurnInput,
} from "@/features/agent/provider";
import {
  QWEN_RULE_FALLBACK,
  ResilientAIProvider,
} from "@/features/agent/resilient-provider";

const input: ProviderTurnInput = {
  messages: [{ role: "user", content: "查找附近超市" }],
};

async function collect(provider: AIProvider) {
  const events: ProviderEvent[] = [];
  for await (const event of provider.streamTurn(
    input,
    new AbortController().signal,
  )) {
    events.push(event);
  }
  return events;
}

describe("ResilientAIProvider", () => {
  it("switches visibly to the deterministic provider before any primary output", async () => {
    const primary: AIProvider = {
      async *streamTurn() {
        throw new Error("provider unavailable");
      },
    };
    const fallback = {
      streamTurn: vi.fn(async function* () {
        yield { type: "text_delta", delta: "规则查询已完成。" } as const;
        yield { type: "finish", reason: "stop" } as const;
      }),
    } satisfies AIProvider;
    const provider = new ResilientAIProvider({ primary, fallback });

    expect(await collect(provider)).toEqual([
      {
        type: "warning",
        code: QWEN_RULE_FALLBACK,
        message:
          "千问服务暂时不可用，已切换为规则化工具查询；实时事实仍只采用工具结果。",
      },
      { type: "text_delta", delta: "规则查询已完成。" },
      { type: "finish", reason: "stop" },
    ]);
    expect(await collect(provider)).toEqual([
      { type: "text_delta", delta: "规则查询已完成。" },
      { type: "finish", reason: "stop" },
    ]);
    expect(fallback.streamTurn).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate a response after the primary emitted output", async () => {
    const primary: AIProvider = {
      async *streamTurn() {
        yield { type: "text_delta", delta: "部分回答" } as const;
        throw new Error("stream interrupted");
      },
    };
    const fallback = {
      streamTurn: vi.fn(async function* () {
        yield { type: "finish", reason: "stop" } as const;
      }),
    } satisfies AIProvider;
    const provider = new ResilientAIProvider({ primary, fallback });

    await expect(collect(provider)).rejects.toThrow("stream interrupted");
    expect(fallback.streamTurn).not.toHaveBeenCalled();
  });
});
