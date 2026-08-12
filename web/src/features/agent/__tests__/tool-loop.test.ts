import { describe, expect, it, vi } from "vitest";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import type {
  AIProvider,
  ProviderEvent,
  ProviderTurnInput,
} from "@/features/agent/provider";
import { runAgentToolLoop } from "@/features/agent/tool-loop";
import { ToolExecutor } from "@/features/agent/tools/executor";
import { createDemoRepository } from "@/features/business/demo-repository";

import { createToolTestContext } from "../tools/__tests__/helpers";

class SequenceProvider implements AIProvider {
  readonly turns: ProviderTurnInput[] = [];

  constructor(
    private readonly sequences: readonly (readonly ProviderEvent[])[],
  ) {}

  async *streamTurn(input: ProviderTurnInput): AsyncIterable<ProviderEvent> {
    const index = this.turns.length;
    this.turns.push(input);
    for (const event of this.sequences[index] ?? []) yield event;
  }
}

const houseArgs = {
  city: "杭州",
  near_location: null,
  min_price: null,
  max_price: 3_500,
  room_type: "一居室",
  limit: 5,
};

function toolCall(id: string, args: unknown = houseArgs): ProviderEvent {
  return {
    type: "tool_calls",
    calls: [
      {
        id,
        name: "search_houses",
        arguments: JSON.stringify(args),
      },
    ],
  };
}

async function collect(
  provider: AIProvider,
  options: { debug?: boolean; executor?: ToolExecutor } = {},
) {
  const events: ChatStreamEvent[] = [];
  const completions: unknown[] = [];
  for await (const event of runAgentToolLoop({
    provider,
    messages: [{ role: "user", content: "找房" }],
    signal: new AbortController().signal,
    executor: options.executor ?? new ToolExecutor(),
    toolContext: createToolTestContext(),
    debug: options.debug ?? false,
    onComplete: async (completion) => {
      completions.push(completion);
    },
  })) {
    events.push(event);
  }
  return { completions, events };
}

describe("agent tool loop", () => {
  it("executes a tool, appends tool messages, emits cards and continues the model", async () => {
    const provider = new SequenceProvider([
      [toolCall("call-house"), { type: "finish", reason: "tool_calls" }],
      [
        { type: "text_delta", delta: "找到符合条件的历史房源。" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const { events, completions } = await collect(provider);

    expect(events.map((event) => event.type)).toEqual([
      "tool_progress",
      "tool_progress",
      "tool_progress",
      "result_cards",
      "assistant_delta",
      "done",
    ]);
    const cardEvent = events.find((event) => event.type === "result_cards");
    expect(
      cardEvent?.type === "result_cards" && cardEvent.cards.length,
    ).toBeGreaterThan(0);
    expect(
      cardEvent?.type === "result_cards" &&
        cardEvent.cards.every((card) => card.kind === "house"),
    ).toBe(true);
    expect(provider.turns[0]?.tools).toHaveLength(10);
    expect(provider.turns[1]?.messages.at(-2)).toMatchObject({
      role: "assistant",
      toolCalls: [{ id: "call-house", name: "search_houses" }],
    });
    expect(provider.turns[1]?.messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-house",
    });
    expect(completions).toEqual([
      expect.objectContaining({
        assistantText: "找到符合条件的历史房源。",
        finishReason: "stop",
        cards: expect.arrayContaining([
          expect.objectContaining({ kind: "house" }),
        ]),
      }),
    ]);
  });

  it("keeps model usage split by request round for tiered pricing", async () => {
    const provider = new SequenceProvider([
      [
        { type: "usage", inputTokens: 100_000, outputTokens: 100 },
        toolCall("call-priced"),
        { type: "finish", reason: "tool_calls" },
      ],
      [
        { type: "text_delta", delta: "已完成。" },
        { type: "usage", inputTokens: 100_000, outputTokens: 200 },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const { completions } = await collect(provider);

    expect(completions).toEqual([
      expect.objectContaining({
        inputTokens: 200_000,
        outputTokens: 300,
        usageRounds: [
          { inputTokens: 100_000, outputTokens: 100 },
          { inputTokens: 100_000, outputTokens: 200 },
        ],
      }),
    ]);
  });

  it("does not price a turn when any model round omits usage", async () => {
    const provider = new SequenceProvider([
      [
        toolCall("call-missing-usage"),
        { type: "finish", reason: "tool_calls" },
      ],
      [
        { type: "text_delta", delta: "已完成。" },
        { type: "usage", inputTokens: 100, outputTokens: 20 },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const { completions } = await collect(provider);

    expect(completions).toEqual([
      expect.not.objectContaining({
        usageRounds: expect.anything(),
      }),
    ]);
  });

  it("deduplicates canonical name and arguments across the whole user turn", async () => {
    const business = createDemoRepository();
    const listHouses = vi.spyOn(business, "listHouses");
    const executor = new ToolExecutor();
    const provider = new SequenceProvider([
      [
        {
          type: "tool_calls",
          calls: [
            {
              id: "call-a",
              name: "search_houses",
              arguments: JSON.stringify(houseArgs),
            },
            {
              id: "call-b",
              name: "search_houses",
              arguments: JSON.stringify({
                limit: 5,
                room_type: "一居室",
                max_price: 3_500,
                min_price: null,
                near_location: null,
                city: "杭州",
              }),
            },
          ],
        },
        { type: "finish", reason: "tool_calls" },
      ],
      [{ type: "finish", reason: "stop" }],
    ]);
    const events: ChatStreamEvent[] = [];
    for await (const event of runAgentToolLoop({
      provider,
      messages: [{ role: "user", content: "找房" }],
      signal: new AbortController().signal,
      executor,
      toolContext: createToolTestContext({ business }),
      debug: false,
    })) {
      events.push(event);
    }

    expect(listHouses).toHaveBeenCalledTimes(1);
    expect(
      events.filter((event) => event.type === "result_cards"),
    ).toHaveLength(1);
    expect(
      provider.turns[1]?.messages.filter((message) => message.role === "tool"),
    ).toHaveLength(2);
  });

  it("allows one invalid-argument repair and executes the corrected call", async () => {
    const provider = new SequenceProvider([
      [
        toolCall("invalid", { ...houseArgs, limit: 50 }),
        { type: "finish", reason: "tool_calls" },
      ],
      [toolCall("corrected"), { type: "finish", reason: "tool_calls" }],
      [
        { type: "text_delta", delta: "已修正查询条件。" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const { events } = await collect(provider);

    expect(provider.turns).toHaveLength(3);
    expect(events.some((event) => event.type === "result_cards")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });

  it("tells the model how to repair an invented product store id", async () => {
    const invalidProductArgs = {
      query: "早餐",
      category: null,
      store_id: "demo-store-001",
      max_price: 30,
      in_stock_only: true,
      limit: 6,
    };
    const provider = new SequenceProvider([
      [
        {
          type: "tool_calls",
          calls: [
            {
              id: "invalid-product",
              name: "search_products",
              arguments: JSON.stringify(invalidProductArgs),
            },
          ],
        },
        { type: "finish", reason: "tool_calls" },
      ],
      [
        {
          type: "tool_calls",
          calls: [
            {
              id: "corrected-product",
              name: "search_products",
              arguments: JSON.stringify({
                ...invalidProductArgs,
                store_id: null,
              }),
            },
          ],
        },
        { type: "finish", reason: "tool_calls" },
      ],
      [
        { type: "text_delta", delta: "已找到早餐商品。" },
        { type: "finish", reason: "stop" },
      ],
    ]);

    const { events } = await collect(provider);
    const repairMessage = provider.turns[1]?.messages.find(
      (message) =>
        message.role === "tool" && message.toolCallId === "invalid-product",
    );
    expect(repairMessage).toMatchObject({ role: "tool" });
    expect(JSON.parse(repairMessage?.content ?? "{}")).toMatchObject({
      repairAllowed: true,
      repairHint: expect.stringMatching(/store_id.*null/u),
    });
    expect(
      events.some(
        (event) =>
          event.type === "result_cards" &&
          event.cards.some((card) => card.kind === "product"),
      ),
    ).toBe(true);
  });

  it("counts an identical invalid call as the exhausted repair attempt", async () => {
    const invalidArgs = { ...houseArgs, limit: 50 };
    const provider = new SequenceProvider([
      [
        toolCall("invalid-first", invalidArgs),
        { type: "finish", reason: "tool_calls" },
      ],
      [
        toolCall("invalid-repeated", invalidArgs),
        { type: "finish", reason: "tool_calls" },
      ],
      [toolCall("blocked-valid"), { type: "finish", reason: "tool_calls" }],
      [
        { type: "text_delta", delta: "请换一种说法。" },
        { type: "finish", reason: "stop" },
      ],
    ]);

    const { events } = await collect(provider);

    expect(events).toContainEqual({
      type: "warning",
      code: "TOOL_ARGUMENTS_REPAIR_EXHAUSTED",
      message: "工具参数连续无效，请换一种说法后重试",
    });
    expect(events.some((event) => event.type === "result_cards")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });

  it("blocks a tool after the second distinct invalid argument attempt", async () => {
    const provider = new SequenceProvider([
      [
        toolCall("invalid-1", { ...houseArgs, limit: 50 }),
        { type: "finish", reason: "tool_calls" },
      ],
      [
        toolCall("invalid-2", { ...houseArgs, limit: 60 }),
        { type: "finish", reason: "tool_calls" },
      ],
      [toolCall("blocked-valid"), { type: "finish", reason: "tool_calls" }],
      [
        { type: "text_delta", delta: "请换一种说法。" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const { events } = await collect(provider);

    expect(events).toContainEqual({
      type: "warning",
      code: "TOOL_ARGUMENTS_REPAIR_EXHAUSTED",
      message: "工具参数连续无效，请换一种说法后重试",
    });
    expect(events.some((event) => event.type === "result_cards")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });

  it("stops after eight model rounds instead of looping forever", async () => {
    const sequences = Array.from({ length: 8 }, (_, index) => [
      toolCall(`call-${index}`),
      { type: "finish", reason: "tool_calls" } as const,
    ]);
    const provider = new SequenceProvider(sequences);
    const { events, completions } = await collect(provider);

    expect(provider.turns).toHaveLength(8);
    expect(events).toContainEqual({
      type: "warning",
      code: "TOOL_ROUND_LIMIT",
      message: "工具调用已达到 8 轮，请缩小问题范围后重试",
    });
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "tool_limit" });
    expect(completions).toEqual([
      expect.objectContaining({ finishReason: "tool_limit" }),
    ]);
  });

  it("emits internal tool names only when debug is enabled", async () => {
    const sequences: readonly (readonly ProviderEvent[])[] = [
      [toolCall("call-debug"), { type: "finish", reason: "tool_calls" }],
      [{ type: "finish", reason: "stop" }],
    ];
    const hidden = await collect(new SequenceProvider(sequences));
    const visible = await collect(new SequenceProvider(sequences), {
      debug: true,
    });

    expect(hidden.events.some((event) => event.type === "debug_tool_run")).toBe(
      false,
    );
    expect(
      visible.events.find((event) => event.type === "debug_tool_run"),
    ).toMatchObject({ run: { toolName: "search_houses" } });
  });
});
