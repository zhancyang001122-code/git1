import { describe, expect, it } from "vitest";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import { DemoToolCallingProvider } from "@/features/agent/demo-tool-provider";
import { runAgentToolLoop } from "@/features/agent/tool-loop";
import { ToolExecutor } from "@/features/agent/tools/executor";
import { createDemoRepository } from "@/features/business/demo-repository";
import type { MapsService } from "@/features/maps/types";
import { AppError } from "@/lib/errors";

import { createToolTestContext } from "../tools/__tests__/helpers";

function timedOutNearbyService(): MapsService {
  return {
    convertGps: async (point) => point,
    geocode: async () => ({ longitude: 120.163102, latitude: 30.274085 }),
    searchNearby: async () => {
      throw new AppError({
        code: "AMAP_TIMEOUT",
        message: "高德地图响应超时",
        retryable: true,
      });
    },
    walkingRoute: async () => null,
  };
}

describe("map partial failure", () => {
  it("keeps housing cards, marks map progress failed and emits no place card", async () => {
    const events: ChatStreamEvent[] = [];
    for await (const event of runAgentToolLoop({
      provider: new DemoToolCallingProvider(),
      messages: [
        {
          role: "user",
          content: "找武林广场附近3500元以内允许养猫的一居室",
        },
      ],
      signal: new AbortController().signal,
      executor: new ToolExecutor(),
      toolContext: createToolTestContext({
        business: createDemoRepository(),
        maps: timedOutNearbyService(),
      }),
      debug: true,
    })) {
      events.push(event);
    }

    const cards = events.flatMap((event) =>
      event.type === "result_cards" ? event.cards : [],
    );
    const progress = events.flatMap((event) =>
      event.type === "tool_progress" ? [event.progress] : [],
    );
    const answer = events
      .flatMap((event) =>
        event.type === "assistant_delta" ? [event.delta] : [],
      )
      .join("");

    expect(cards.some((card) => card.kind === "house")).toBe(true);
    expect(cards.some((card) => card.kind === "place")).toBe(false);
    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "amap", status: "failed" }),
      ]),
    );
    expect(answer).toContain("周边条件尚未通过高德核验");
    expect(answer).not.toMatch(/约\s*\d+\s*(?:米|分钟)/);
  });
});
