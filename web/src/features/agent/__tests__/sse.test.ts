import { describe, expect, it } from "vitest";

import {
  initialChatStreamState,
  reduceChatStreamEvent,
} from "@/features/agent/chat-events";
import { SseEventParser, encodeSseEvent } from "@/features/agent/sse";

describe("chat SSE protocol", () => {
  it("encodes the public tool_progress payload without an extra wrapper", () => {
    const frame = encodeSseEvent({
      type: "tool_progress",
      progress: {
        id: "run-1",
        label: "正在查询房源",
        status: "running",
        source: "supabase_mock",
        startedAt: "2026-08-11T00:00:00.000Z",
        completedAt: null,
      },
    });

    expect(frame).toContain("event: tool_progress\n");
    expect(frame).toContain('data: {"id":"run-1","label":"正在查询房源"');
    expect(frame).not.toContain('data: {"progress"');
  });

  it("parses frames split across arbitrary chunks and preserves Unicode", () => {
    const parser = new SseEventParser();
    expect(parser.push('event: assistant_delta\ndata: {"delta":"我找')).toEqual(
      [],
    );
    expect(
      parser.push(
        '到房源了"}\n\nevent: done\ndata: {"finishReason":"stop"}\n\n',
      ),
    ).toEqual([
      { type: "assistant_delta", delta: "我找到房源了" },
      { type: "done", finishReason: "stop" },
    ]);
  });

  it("reduces progress by id and preserves partial text on warning and error", () => {
    const session = reduceChatStreamEvent(initialChatStreamState, {
      type: "session",
      sessionId: "71000000-0000-0000-0000-000000000001",
      messageId: "72000000-0000-0000-0000-000000000001",
    });
    const text = reduceChatStreamEvent(session, {
      type: "assistant_delta",
      delta: "已找到",
    });
    const warning = reduceChatStreamEvent(text, {
      type: "warning",
      code: "PARTIAL",
      message: "部分来源暂不可用",
    });
    const failed = reduceChatStreamEvent(warning, {
      type: "error",
      code: "QWEN_PROVIDER_FAILED",
      message: "模型暂时不可用",
      retryable: true,
    });

    expect(failed.assistantText).toBe("已找到");
    expect(failed.warnings).toEqual([
      { code: "PARTIAL", message: "部分来源暂不可用" },
    ]);
    expect(failed.error).toEqual({
      code: "QWEN_PROVIDER_FAILED",
      message: "模型暂时不可用",
      retryable: true,
    });
  });

  it("replaces a repeated card with the newer exact result", () => {
    let state = reduceChatStreamEvent(initialChatStreamState, {
      type: "result_cards",
      cards: [
        {
          kind: "product",
          data: { id: "product-1", name: "鲜牛奶", inStock: true },
        },
      ],
    });
    state = reduceChatStreamEvent(state, {
      type: "result_cards",
      cards: [
        {
          kind: "product",
          data: { id: "product-1", name: "鲜牛奶", availableStock: 30 },
        },
      ],
    });

    expect(state.cards).toEqual([
      {
        kind: "product",
        data: { id: "product-1", name: "鲜牛奶", availableStock: 30 },
      },
    ]);
  });

  it("rejects malformed event data with a stable protocol error", () => {
    const parser = new SseEventParser();
    expect(() => parser.push("event: done\ndata: {}\n\n")).toThrowError(
      expect.objectContaining({ code: "SSE_PROTOCOL_INVALID" }),
    );
  });
});
