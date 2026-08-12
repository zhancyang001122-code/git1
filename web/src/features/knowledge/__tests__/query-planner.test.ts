import { describe, expect, it } from "vitest";

import { planKnowledgeQuery } from "@/features/knowledge/query-planner";

describe("knowledge query planner", () => {
  it.each([
    ["未使用的团购券可以退款吗", "group_buy", "refund"],
    ["退租验房后押金怎么处理", "housing", "deposit"],
    ["租房押金多久退", "housing", "deposit"],
    ["超市配送超时怎么办", "market", "delivery"],
    [
      "Production 现在用什么方式登录，是否已经完成验收？",
      "platform",
      "portfolio_data_memory",
    ],
  ] as const)(
    "maps %s to an allowlisted domain and category",
    (query, domain, category) => {
      expect(
        planKnowledgeQuery({
          query,
          domain: null,
          category: null,
          city: "杭州",
          topK: 5,
        }),
      ).toMatchObject({ domain, category, city: "杭州" });
    },
  );

  it("does not force unknown text into a domain", () => {
    const plan = planKnowledgeQuery({
      query: "今天心情怎么样",
      domain: null,
      category: null,
      city: null,
      topK: 5,
    });

    expect(plan).not.toHaveProperty("domain");
    expect(plan).not.toHaveProperty("category");
  });

  it("drops unsupported proposed metadata instead of forwarding it to SQL", () => {
    expect(
      planKnowledgeQuery({
        query: "退款规则",
        domain: "group_buy",
        category: "refund' OR 1=1 --",
        city: "杭州",
        topK: 5,
      }),
    ).toMatchObject({ domain: "group_buy", category: "refund" });
  });

  it("preserves the reviewed portfolio first-party categories", () => {
    expect(
      planKnowledgeQuery({
        query: "小智是原生微信小程序吗？",
        domain: "platform",
        category: "portfolio_capabilities",
        city: null,
        topK: 5,
      }),
    ).toMatchObject({
      domain: "platform",
      category: "portfolio_capabilities",
    });
  });
});
