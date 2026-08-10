import { describe, expect, it } from "vitest";

import { FakeAIProvider } from "@/features/agent/fake-provider";

describe("FakeAIProvider", () => {
  it("streams a deterministic direct-text fixture", async () => {
    const provider = new FakeAIProvider([
      { type: "text_delta", delta: "你好，" },
      { type: "text_delta", delta: "我是小智。" },
      { type: "usage", inputTokens: 12, outputTokens: 8 },
      { type: "finish", reason: "stop" },
    ]);
    const events = [];

    for await (const event of provider.streamTurn(
      { messages: [{ role: "user", content: "你好" }] },
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text_delta", delta: "你好，" },
      { type: "text_delta", delta: "我是小智。" },
      { type: "usage", inputTokens: 12, outputTokens: 8 },
      { type: "finish", reason: "stop" },
    ]);
    expect(provider.turns).toHaveLength(1);
  });

  it("stops before yielding when the request is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new FakeAIProvider([
      { type: "text_delta", delta: "不应出现" },
    ]);

    const read = async () => {
      for await (const event of provider.streamTurn(
        { messages: [{ role: "user", content: "取消" }] },
        controller.signal,
      )) {
        void event;
      }
    };

    await expect(read()).rejects.toMatchObject({ code: "PROVIDER_ABORTED" });
  });

  it("can fixture a provider failure without exposing SDK objects", async () => {
    const provider = FakeAIProvider.failing("QWEN_PROVIDER_TIMEOUT", true);
    const read = async () => {
      for await (const event of provider.streamTurn(
        { messages: [{ role: "user", content: "超时测试" }] },
        new AbortController().signal,
      )) {
        void event;
      }
    };

    await expect(read()).rejects.toMatchObject({
      code: "QWEN_PROVIDER_TIMEOUT",
      retryable: true,
    });
  });
});
