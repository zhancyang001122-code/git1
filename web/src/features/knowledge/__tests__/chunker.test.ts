import { describe, expect, it } from "vitest";

import { chunkKnowledgeVersion } from "@/features/knowledge/chunker";

const paragraph =
  "未使用且仍在有效期内的团购券可以申请退款，但已经核销、已经履约或者页面明确标注不可退的套餐不适用。处理前必须核对订单状态、券状态和商家页面，不得仅凭用户描述直接承诺。";

describe("knowledge chunker", () => {
  it("is deterministic, preserves heading paths and keeps target-sized chunks", () => {
    const input = {
      articleId: "61000000-0000-0000-0000-000000000001",
      versionId: "62000000-0000-0000-0000-000000000001",
      title: "团购券退款规则",
      domain: "group_buy" as const,
      category: "refund",
      city: "杭州",
      isDemo: true,
      contentMarkdown: `# 团购券退款规则\n\n## 适用条件\n\n${Array(8).fill(paragraph).join("\n\n")}\n\n## 不适用条件\n\n${Array(6).fill(paragraph).join("\n\n")}`,
    };

    const first = chunkKnowledgeVersion(input);
    const second = chunkKnowledgeVersion(input);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(2);
    expect(first.every((chunk) => chunk.content.length <= 700)).toBe(true);
    expect(first.every((chunk) => chunk.contentHash.length === 64)).toBe(true);
    expect(first.every((chunk) => chunk.metadata.isDemo === true)).toBe(true);
    expect(first.some((chunk) => chunk.headingPath.includes("适用条件"))).toBe(
      true,
    );
    expect(first.map((chunk) => chunk.chunkIndex)).toEqual(
      first.map((_chunk, index) => index),
    );
  });

  it("normalizes line endings and does not duplicate an entire previous chunk", () => {
    const chunks = chunkKnowledgeVersion({
      articleId: "61000000-0000-0000-0000-000000000001",
      versionId: "62000000-0000-0000-0000-000000000001",
      title: "测试",
      domain: "platform",
      category: "faq",
      city: null,
      isDemo: false,
      contentMarkdown: `# 标题\r\n\r\n${Array(12).fill(paragraph).join("\r\n\r\n")}`,
    });

    expect(chunks.every((chunk) => !chunk.content.includes("\r"))).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.content)).size).toBe(
      chunks.length,
    );
  });
});
