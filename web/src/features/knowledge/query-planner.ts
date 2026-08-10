import type {
  KnowledgeDomain,
  KnowledgeQueryPlan,
  KnowledgeSearchInput,
} from "@/features/knowledge/types";

const categoriesByDomain: Readonly<Record<KnowledgeDomain, readonly string[]>> =
  {
    housing: ["pet", "deposit"],
    group_buy: ["refund"],
    market: ["delivery"],
    platform: ["faq", "privacy", "account"],
  };

const routes: readonly {
  pattern: RegExp;
  domain: KnowledgeDomain;
  category: string;
}[] = [
  {
    pattern: /退款|退券|不可退|过期券|核销/,
    domain: "group_buy",
    category: "refund",
  },
  {
    pattern: /宠物|养猫|养狗|抓坏|损坏责任/,
    domain: "housing",
    category: "pet",
  },
  { pattern: /押金|退租|验房/, domain: "housing", category: "deposit" },
  {
    pattern: /配送|送达|骑手|超时|补偿/,
    domain: "market",
    category: "delivery",
  },
];

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function allowedCategory(
  domain: KnowledgeDomain | undefined,
  category: string | null,
): string | undefined {
  if (!domain || !category) return undefined;
  return categoriesByDomain[domain].includes(category) ? category : undefined;
}

export function planKnowledgeQuery(
  input: KnowledgeSearchInput,
): KnowledgeQueryPlan {
  const rewrittenQuery = clean(input.query);
  const inferred = routes.find((route) => route.pattern.test(rewrittenQuery));
  const domain = input.domain ?? inferred?.domain;
  const explicitCategory = allowedCategory(domain, input.category);
  const category =
    explicitCategory ??
    (inferred && inferred.domain === domain ? inferred.category : undefined);
  return {
    rewrittenQuery,
    ...(domain && { domain }),
    ...(category && { category }),
    ...(input.city && { city: clean(input.city) }),
  };
}
