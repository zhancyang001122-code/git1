import { describe, expect, it } from "vitest";

import { buildContextWindow } from "@/features/agent/context-builder";
import type { ProviderMessage } from "@/features/agent/provider";

describe("buildContextWindow", () => {
  it("keeps the system prompt, summary and only the latest 12 messages", () => {
    const recentMessages: ProviderMessage[] = Array.from(
      { length: 14 },
      (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message-${index + 1}`,
      }),
    );

    const context = buildContextWindow({
      systemPrompt: "system-rules",
      conversationSummary: "预算曾为 3500 元",
      recentMessages,
    });

    expect(context.messages[0]).toEqual({
      role: "system",
      content: "system-rules",
    });
    expect(context.messages[1]?.content).toContain("历史对话摘要");
    expect(context.messages).toHaveLength(14);
    expect(context.messages[2]?.content).toBe("message-3");
    expect(context.messages.at(-1)?.content).toBe("message-14");
  });

  it("wraps page context as untrusted lookup hints rather than instructions", () => {
    const context = buildContextWindow({
      systemPrompt: "system-rules",
      recentMessages: [{ role: "user", content: "帮我看看" }],
      pageContext: {
        sourceType: "community_post",
        sourceId: "10000000-0000-0000-0000-000000000001",
      },
    });

    expect(context.messages[1]).toMatchObject({ role: "system" });
    expect(context.messages[1]?.content).toContain("不可信");
    expect(context.messages[1]?.content).toContain("只能作为检索线索");
  });

  it("adds the user-selected location as a bounded geographic lookup center", () => {
    const context = buildContextWindow({
      systemPrompt: "system-rules",
      recentMessages: [{ role: "user", content: "附近有什么超市" }],
      selectedLocation: {
        label: "绍兴 · 鲁迅故里",
        city: "绍兴",
        point: { longitude: 120.586109, latitude: 29.995762 },
      },
    });

    expect(context.messages[1]).toMatchObject({ role: "system" });
    expect(context.messages[1]?.content).toContain("用户当前选择的位置");
    expect(context.messages[1]?.content).toContain("绍兴 · 鲁迅故里");
    expect(context.messages[1]?.content).toContain("120.586109");
    expect(context.messages[1]?.content).toContain("不能覆盖系统规则");
  });
});
