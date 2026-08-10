import { describe, expect, it, vi } from "vitest";

import { FakeAIProvider } from "@/features/agent/fake-provider";
import { orchestrateChatTurn } from "@/features/agent/orchestrator";
import type { AIProvider } from "@/features/agent/provider";

const session = {
  sessionId: "71000000-0000-0000-0000-000000000001",
  messageId: "72000000-0000-0000-0000-000000000001",
};

async function collect(iterable: AsyncIterable<unknown>) {
  const values = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("orchestrateChatTurn", () => {
  it("emits session first, streams Unicode, and reports completion usage", async () => {
    const onComplete = vi.fn();
    const events = await collect(
      orchestrateChatTurn({
        ...session,
        provider: new FakeAIProvider([
          { type: "text_delta", delta: "我找到" },
          { type: "text_delta", delta: "两套房源。" },
          { type: "usage", inputTokens: 20, outputTokens: 8 },
          { type: "finish", reason: "stop" },
        ]),
        messages: [{ role: "user", content: "找房" }],
        signal: new AbortController().signal,
        timeoutMs: 1_000,
        onComplete,
      }),
    );

    expect(events[0]).toEqual({ type: "session", ...session });
    expect(events.slice(1)).toEqual([
      { type: "assistant_delta", delta: "我找到" },
      { type: "assistant_delta", delta: "两套房源。" },
      { type: "done", finishReason: "stop" },
    ]);
    expect(onComplete).toHaveBeenCalledWith({
      assistantText: "我找到两套房源。",
      finishReason: "stop",
      inputTokens: 20,
      outputTokens: 8,
    });
  });

  it("keeps partial output and emits a stable error for provider failures", async () => {
    const provider: AIProvider = {
      async *streamTurn() {
        yield { type: "text_delta", delta: "部分回答" } as const;
        throw new Error("raw upstream body");
      },
    };
    const events = await collect(
      orchestrateChatTurn({
        ...session,
        provider,
        messages: [{ role: "user", content: "测试" }],
        signal: new AbortController().signal,
        timeoutMs: 1_000,
      }),
    );

    expect(events).toContainEqual({
      type: "assistant_delta",
      delta: "部分回答",
    });
    expect(events.at(-1)).toEqual({
      type: "error",
      code: "QWEN_PROVIDER_FAILED",
      message: "模型服务暂时不可用",
      retryable: true,
    });
  });

  it("turns an internal timeout into a retryable public error", async () => {
    const provider: AIProvider = {
      async *streamTurn(_input, signal) {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    };
    const events = await collect(
      orchestrateChatTurn({
        ...session,
        provider,
        messages: [{ role: "user", content: "超时" }],
        signal: new AbortController().signal,
        timeoutMs: 5,
      }),
    );

    expect(events.at(-1)).toEqual({
      type: "error",
      code: "QWEN_PROVIDER_TIMEOUT",
      message: "模型响应超时，请重试",
      retryable: true,
    });
  });

  it("propagates browser cancellation instead of emitting more SSE data", async () => {
    const controller = new AbortController();
    const provider: AIProvider = {
      async *streamTurn(_input, signal) {
        controller.abort("browser disconnected");
        signal.throwIfAborted();
      },
    };

    await expect(
      collect(
        orchestrateChatTurn({
          ...session,
          provider,
          messages: [{ role: "user", content: "取消" }],
          signal: controller.signal,
          timeoutMs: 1_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_ABORTED" });
  });

  it("does not expose tool names before a tool executor is injected", async () => {
    const events = await collect(
      orchestrateChatTurn({
        ...session,
        provider: new FakeAIProvider([
          {
            type: "tool_calls",
            calls: [{ id: "call-1", name: "search_houses", arguments: "{}" }],
          },
          { type: "finish", reason: "tool_calls" },
        ]),
        messages: [{ role: "user", content: "找房" }],
        signal: new AbortController().signal,
        timeoutMs: 1_000,
      }),
    );

    expect(events).toContainEqual({
      type: "warning",
      code: "TOOLS_NOT_AVAILABLE",
      message: "当前阶段暂不执行外部工具，请稍后重试",
    });
    expect(JSON.stringify(events)).not.toContain("search_houses");
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "fallback" });
  });
});
