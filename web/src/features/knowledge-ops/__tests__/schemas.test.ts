import { describe, expect, it } from "vitest";

import {
  candidateInputSchema,
  manualMaterialInputSchema,
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

  it("rejects impossible or inverted manual material dates", () => {
    const material = {
      question: "历史房源能代表当前可租状态吗？",
      draft: {
        title: "历史房源数据使用边界",
        answerMarkdown:
          "历史房源数据只用于筛选能力演示，不能代表当前可租状态。",
        changeSummary: "首次录入",
        sourceReference: "housing-data-readme.md",
        owner: "作品集作者",
        domain: "housing" as const,
        category: "data_freshness",
        versionLabel: "v1.0",
        effectiveFrom: "2026-02-31",
      },
    };
    expect(manualMaterialInputSchema.safeParse(material).success).toBe(false);
    expect(
      manualMaterialInputSchema.safeParse({
        ...material,
        draft: {
          ...material.draft,
          effectiveFrom: "2026-08-12",
          effectiveUntil: "2026-08-11",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts official public material as a distinct provenance kind", () => {
    const result = manualMaterialInputSchema.safeParse({
      question: "租房签约前要核验哪些信息？",
      draft: {
        title: "住房租赁条例：签约与房源核验要点",
        answerMarkdown:
          "依据公开行政法规整理，签约前应核验房屋权属和出租人身份信息。",
        changeSummary: "录入官方公开资料摘要",
        sourceReference: "https://xzfg.moj.gov.cn/front/law/detail?LawID=1774",
        owner: "中华人民共和国国务院",
        domain: "housing",
        category: "rental_contract_official",
        versionLabel: "国务院令第812号",
        materialKind: "public_official",
        effectiveFrom: "2025-09-15",
      },
    });

    expect(result.success).toBe(true);
  });
});
