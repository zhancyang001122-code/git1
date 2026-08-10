import type { ResultCard } from "@/features/agent/chat-events";
import type { ToolResult } from "@/features/agent/tools/types";

const PUBLIC_FACT_FIELDS = [
  "id",
  "name",
  "title",
  "city",
  "district",
  "address",
  "category",
  "priceMonthly",
  "salePrice",
  "price",
  "roomType",
  "areaSqm",
  "petsAllowed",
  "refundable",
  "inStock",
  "availableStock",
  "distanceM",
  "durationSeconds",
  "historicalYear",
  "isDemo",
] as const;

function publicFact(card: ResultCard): Record<string, unknown> {
  const fact: Record<string, unknown> = { kind: card.kind };
  for (const field of PUBLIC_FACT_FIELDS) {
    const value = card.data[field];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      fact[field] = value;
    }
  }
  return fact;
}

function knowledgePayload(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data))
    return undefined;
  const value = data as Record<string, unknown>;
  const passages = Array.isArray(value.passages)
    ? value.passages.slice(0, 5).flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
          return [];
        const passage = entry as Record<string, unknown>;
        return [
          Object.fromEntries(
            [
              "chunkId",
              "title",
              "versionLabel",
              "effectiveFrom",
              "content",
              "score",
            ]
              .filter((field) => passage[field] !== undefined)
              .map((field) => [
                field,
                field === "content" && typeof passage[field] === "string"
                  ? passage[field].slice(0, 600)
                  : passage[field],
              ]),
          ),
        ];
      })
    : [];

  return {
    instructionPolicy: "evidence_only",
    lowConfidence: value.lowConfidence === true,
    conflict: value.conflict === true,
    isDemo: value.isDemo === true,
    passages,
  };
}

export function buildToolModelPayload(
  toolName: string,
  result: ToolResult,
): Record<string, unknown> {
  const facts = (result.cards ?? []).slice(0, 20).map(publicFact);
  const itemIds = facts.flatMap((fact) =>
    typeof fact.id === "string" ? [fact.id] : [],
  );

  return {
    ok: result.ok,
    source: result.source,
    resultCount: result.resultCount,
    ...(result.error && { error: result.error }),
    ...(itemIds.length > 0 && { itemIds }),
    ...(facts.length > 0 && { facts }),
    ...(toolName === "search_knowledge" && {
      knowledge: knowledgePayload(result.data),
    }),
  };
}
