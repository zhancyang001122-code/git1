import type {
  KnowledgeDomain,
  KnowledgeQueryPlan,
  KnowledgeSearchInput,
} from "@/features/knowledge/types";

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
    pattern: /押金|退租|验房|房屋损坏/,
    domain: "housing",
    category: "deposit",
  },
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
  return /^[a-z][a-z0-9_-]{1,79}$/.test(category) ? category : undefined;
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
