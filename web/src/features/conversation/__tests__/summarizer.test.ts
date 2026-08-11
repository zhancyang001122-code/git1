import { describe, expect, it } from "vitest";

import { summarizeConversation } from "@/features/conversation/summarizer";
import type { ConversationMessage } from "@/features/conversation/repository";

function message(
  role: ConversationMessage["role"],
  content: string,
  index: number,
): ConversationMessage {
  return {
    id: `72000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    sessionId: "71000000-0000-0000-0000-000000000001",
    role,
    content,
    structuredPayload: role === "tool" ? { raw: "do-not-copy" } : null,
    modelName: null,
    inputTokens: null,
    outputTokens: null,
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("summarizeConversation", () => {
  it("summarizes user constraints and unresolved questions without tool payloads or secrets", () => {
    const summary = summarizeConversation([
      message("user", "预算3500元，想找武林广场附近的一居室", 1),
      message("assistant", "请问希望在哪个区域？", 2),
      message("tool", '{"api_key":"secret-value"}', 3),
      message("user", "我的token=very-secret-token，优先拱墅区", 4),
    ]);

    expect(summary).toContain("预算3500元");
    expect(summary).toContain("优先拱墅区");
    expect(summary).not.toContain("secret-value");
    expect(summary).not.toContain("very-secret-token");
    expect(summary).not.toContain("do-not-copy");
    expect(summary.length).toBeLessThanOrEqual(1_200);
  });
});
