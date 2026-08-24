import { describe, expect, it } from "vitest";

import { summarizeGeneration } from "./portfolio-knowledge.mjs";

describe("portfolio knowledge SSE summary", () => {
  it("reads tool progress and debug runs from their flattened wire payloads", () => {
    const result = summarizeGeneration([
      {
        type: "tool_progress",
        data: { source: "knowledge_base", status: "succeeded" },
      },
      {
        type: "debug_tool_run",
        data: {
          toolName: "search_knowledge",
          errorCode: null,
          resultCount: 2,
        },
      },
      {
        type: "result_cards",
        data: { cards: [{ kind: "house" }] },
      },
    ]);

    expect(result).toMatchObject({
      toolSucceeded: true,
      debugRuns: [
        {
          toolName: "search_knowledge",
          errorCode: null,
          resultCount: 2,
        },
      ],
      cards: [{ kind: "house" }],
    });
  });
});
