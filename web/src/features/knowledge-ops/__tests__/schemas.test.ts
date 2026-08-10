import { describe, expect, it } from "vitest";

import {
  candidateInputSchema,
  reviewInputSchema,
} from "@/features/knowledge-ops/schemas";

const candidateId = "64000000-0000-4000-8000-000000000001";

describe("knowledge ops schemas", () => {
  it("rejects an approval without a verifiable source and ownership fields", () => {
    const result = reviewInputSchema.safeParse({
      candidateId,
      decision: "approve",
      draft: {
        title: "过期团购券退款说明",
        answerMarkdown: "过期两天可申请人工复核。",
      },
    });

    expect(result.success).toBe(false);
  });

  it("requires notes when rejecting a candidate", () => {
    expect(
      reviewInputSchema.safeParse({
        candidateId,
        decision: "reject",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("accepts normalized candidate evidence ids without raw conversations", () => {
    const result = candidateInputSchema.parse({
      sourceType: "user_feedback",
      sessionId: "71000000-0000-4000-8000-000000000001",
      messageId: "72000000-0000-4000-8000-000000000001",
      question: "  团购券过期两天可以退款吗？  ",
      domain: "group_buy",
      reason: "missing_source",
      evidence: [
        {
          articleId: "61000000-0000-4000-8000-000000000001",
          versionId: "62000000-0000-4000-8000-000000000001",
          chunkId: "63000000-0000-4000-8000-000000000001",
        },
      ],
    });

    expect(result.question).toBe("团购券过期两天可以退款吗？");
    expect(JSON.stringify(result)).not.toContain("conversation");
  });
});
