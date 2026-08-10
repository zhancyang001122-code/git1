import { describe, expect, it, vi } from "vitest";

import {
  QwenProvider,
  type QwenStreamFactory,
} from "@/features/agent/qwen-provider";

async function* chunks(values: readonly unknown[]) {
  for (const value of values) yield value;
}

describe("QwenProvider", () => {
  it("converts Qwen chunks into provider-neutral text, usage and finish events", async () => {
    const factory: QwenStreamFactory = vi.fn(async () =>
      chunks([
        { choices: [{ delta: { content: "你" }, finish_reason: null }] },
        { choices: [{ delta: { content: "好" }, finish_reason: null }] },
        {
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 7, completion_tokens: 2 },
        },
      ]),
    );
    const provider = new QwenProvider({
      model: "qwen-plus",
      streamFactory: factory,
    });
    const events = [];
    for await (const event of provider.streamTurn(
      { messages: [{ role: "user", content: "你好" }] },
      new AbortController().signal,
    ))
      events.push(event);

    expect(events).toEqual([
      { type: "text_delta", delta: "你" },
      { type: "text_delta", delta: "好" },
      { type: "usage", inputTokens: 7, outputTokens: 2 },
      { type: "finish", reason: "stop" },
    ]);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "qwen-plus",
        stream: true,
        messages: [{ role: "user", content: "你好" }],
      }),
      expect.any(AbortSignal),
    );
  });

  it("assembles streamed tool call fragments by index", async () => {
    const provider = new QwenProvider({
      model: "qwen-plus",
      streamFactory: async () =>
        chunks([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-1",
                      function: { name: "search_houses", arguments: '{"max' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: 'Price":3500}' } },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
    });
    const events = [];
    for await (const event of provider.streamTurn(
      { messages: [{ role: "user", content: "找房" }] },
      new AbortController().signal,
    ))
      events.push(event);

    expect(events).toContainEqual({
      type: "tool_calls",
      calls: [
        { id: "call-1", name: "search_houses", arguments: '{"maxPrice":3500}' },
      ],
    });
    expect(events.at(-1)).toEqual({ type: "finish", reason: "tool_calls" });
  });

  it("normalizes SDK failures without exposing provider response objects", async () => {
    const provider = new QwenProvider({
      model: "qwen-plus",
      streamFactory: async () => {
        throw new Error("raw provider body with secret details");
      },
    });
    const read = async () => {
      for await (const event of provider.streamTurn(
        { messages: [{ role: "user", content: "测试" }] },
        new AbortController().signal,
      ))
        void event;
    };

    await expect(read()).rejects.toMatchObject({
      code: "QWEN_PROVIDER_FAILED",
      message: "模型服务暂时不可用",
      retryable: true,
    });
  });

  it("maps an aborted SDK request to a stable abort error", async () => {
    const controller = new AbortController();
    const provider = new QwenProvider({
      model: "qwen-plus",
      streamFactory: async (_request, signal) => {
        controller.abort("user cancelled");
        signal.throwIfAborted();
        return chunks([]);
      },
    });
    const read = async () => {
      for await (const event of provider.streamTurn(
        { messages: [{ role: "user", content: "取消" }] },
        controller.signal,
      ))
        void event;
    };

    await expect(read()).rejects.toMatchObject({
      code: "PROVIDER_ABORTED",
      retryable: false,
    });
  });
});
