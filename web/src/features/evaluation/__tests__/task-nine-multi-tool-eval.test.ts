import { describe, expect, it } from "vitest";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import { DemoToolCallingProvider } from "@/features/agent/demo-tool-provider";
import { runAgentToolLoop } from "@/features/agent/tool-loop";
import { ToolExecutor } from "@/features/agent/tools/executor";

import { createToolTestContext } from "../../agent/tools/__tests__/helpers";

describe("Task 9 explainable multi-tool scenario", () => {
  it("runs business, nearby and knowledge in dependency order without inventing a route", async () => {
    const events: ChatStreamEvent[] = [];
    for await (const event of runAgentToolLoop({
      provider: new DemoToolCallingProvider(),
      messages: [
        {
          role: "user",
          content:
            "找武林广场附近3500以内且附近有超市的一居室，并告诉我退租押金规则",
        },
      ],
      signal: new AbortController().signal,
      executor: new ToolExecutor(),
      toolContext: createToolTestContext(),
      debug: true,
    })) {
      events.push(event);
    }

    const tools = events.flatMap((event) =>
      event.type === "debug_tool_run" ? [event.run.toolName] : [],
    );
    const cards = events.flatMap((event) =>
      event.type === "result_cards" ? event.cards : [],
    );
    const answer = events
      .flatMap((event) =>
        event.type === "assistant_delta" ? [event.delta] : [],
      )
      .join("");

    expect(tools).toEqual([
      "search_houses",
      "search_nearby_places",
      "search_knowledge",
    ]);
    expect(
      cards.filter((card) => card.kind === "house").length,
    ).toBeLessThanOrEqual(5);
    expect(
      events.some(
        (event) =>
          event.type === "tool_progress" && event.progress.source === "amap",
      ),
    ).toBe(true);
    expect(events.some((event) => event.type === "citations")).toBe(true);
    expect(answer).toContain("合同约定和退租验收结果");
    expect(answer).not.toMatch(/\d+\s*分钟/);
  });
});
