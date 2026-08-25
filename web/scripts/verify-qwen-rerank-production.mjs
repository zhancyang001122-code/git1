import {
  portfolioKnowledgeSearchResultSchema,
  productionUrl,
} from "./lib/portfolio-knowledge.mjs";
import { assertRerankApplied } from "./lib/interview-preflight.mjs";

const baseUrl = productionUrl();

async function json(path, init) {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body && { "content-type": "application/json" }),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  return body;
}

const health = await json("/api/health");
if (health?.mode !== "live" || health?.services?.rerank !== "configured") {
  throw new Error("Production Rerank is not configured in Live mode");
}

const result = portfolioKnowledgeSearchResultSchema.parse(
  await json("/api/knowledge/search", {
    method: "POST",
    body: JSON.stringify({
      query: "历史房源能代表当前可租状态吗？",
      domain: "housing",
      category: null,
      city: "杭州",
      topK: 5,
    }),
  }),
);

assertRerankApplied(result);

console.log(
  JSON.stringify({
    status: "PASS",
    productionUrl: baseUrl.href,
    service: health.services.rerank,
    rankingStrategy: result.rankingStrategy,
    resultCount: result.chunks.length,
    topTitle: result.chunks[0]?.title ?? null,
    warnings: result.warnings,
  }),
);
