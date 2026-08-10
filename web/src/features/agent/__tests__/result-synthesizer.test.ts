import { describe, expect, it } from "vitest";

import { buildToolModelPayload } from "@/features/agent/result-synthesizer";
import type { ToolResult } from "@/features/agent/tools/types";

describe("buildToolModelPayload", () => {
  it("preserves validated card ids and public facts but drops raw row fields", () => {
    const result: ToolResult = {
      ok: true,
      source: "housing_history_2024",
      resultCount: 1,
      data: {
        items: [
          {
            id: "20000000-0000-0000-0000-000000000001",
            internalOwnerPhone: "13800000000",
            rawDescription: "database-only-field",
          },
        ],
      },
      cards: [
        {
          kind: "house",
          data: {
            id: "20000000-0000-0000-0000-000000000001",
            name: "武林晴川一居室",
            priceMonthly: 3_300,
            petsAllowed: true,
          },
        },
      ],
    };

    const payload = buildToolModelPayload("search_houses", result);
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      ok: true,
      source: "housing_history_2024",
      resultCount: 1,
      itemIds: ["20000000-0000-0000-0000-000000000001"],
    });
    expect(serialized).toContain("武林晴川一居室");
    expect(serialized).not.toContain("internalOwnerPhone");
    expect(serialized).not.toContain("database-only-field");
  });

  it("keeps bounded knowledge evidence needed for grounded synthesis", () => {
    const result: ToolResult = {
      ok: true,
      source: "knowledge_base",
      resultCount: 1,
      data: {
        lowConfidence: false,
        conflict: false,
        isDemo: true,
        passages: [
          {
            chunkId: "30000000-0000-0000-0000-000000000001",
            title: "宠物责任演示规则",
            content: "允许宠物不等于免除家具损坏责任。",
            hiddenMetadata: "drop-me",
          },
        ],
      },
    };

    const payload = buildToolModelPayload("search_knowledge", result);
    const serialized = JSON.stringify(payload);

    expect(serialized).toContain("允许宠物不等于免除家具损坏责任");
    expect(serialized).toContain('"isDemo":true');
    expect(serialized).not.toContain("hiddenMetadata");
  });
});
