import { chromium } from "@playwright/test";

import {
  evaluatePortfolioGeneration,
  evaluatePortfolioRetrieval,
  loadPortfolioKnowledge,
  parseSse,
  portfolioKnowledgeSearchResultSchema,
  productionUrl,
  proxyConfiguration,
  requireOkJson,
  summarizeGeneration,
  supabaseConfiguration,
  supabaseRest,
} from "./lib/portfolio-knowledge.mjs";

const production = productionUrl();
const supabase = supabaseConfiguration();
const knowledge = loadPortfolioKnowledge();
const browser = await chromium.launch({
  ...(proxyConfiguration() && { proxy: proxyConfiguration() }),
});
const context = await browser.newContext();
const request = context.request;

async function productionPost(path, body, timeout = 60_000) {
  const response = await request.post(new URL(path, production).href, {
    data: body,
    timeout,
  });
  return response;
}

async function playwrightJson(response, label) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok()) {
    const code =
      body && typeof body === "object"
        ? body.error?.code || body.code || body.message
        : undefined;
    throw new Error(
      `${label} returned HTTP ${response.status()}${code ? ` (${code})` : ""}`,
    );
  }
  return body;
}

async function publishedSources() {
  const references = knowledge.materials.map(
    (material) => material.draft.sourceReference,
  );
  const parameters = new URLSearchParams({
    select:
      "id,article_id,version_label,status,source_reference,kb_articles!kb_article_versions_article_id_fkey!inner(title,status,current_version_id,is_demo,material_kind)",
    source_reference: `in.(${references.map((item) => `\"${item}\"`).join(",")})`,
    status: "eq.published",
  });
  const rows = await requireOkJson(
    await supabaseRest(supabase, `kb_article_versions?${parameters}`),
    "portfolio publication lookup",
  );
  const currentRows = rows.filter(
    (row) => row.kb_articles?.current_version_id === row.id,
  );
  if (currentRows.length !== knowledge.materials.length) {
    throw new Error(
      `expected ${knowledge.materials.length} current published materials, found ${currentRows.length}`,
    );
  }
  for (const row of currentRows) {
    const material = knowledge.materials.find(
      (item) => item.draft.sourceReference === row.source_reference,
    );
    if (
      !material ||
      row.kb_articles?.status !== "published" ||
      row.kb_articles?.current_version_id !== row.id ||
      row.kb_articles?.is_demo !== false ||
      row.kb_articles?.material_kind !== "portfolio_first_party" ||
      row.version_label !== material.draft.versionLabel
    ) {
      throw new Error(`invalid publication state for ${row.source_reference}`);
    }
  }
  return currentRows;
}

async function persistRuns(results) {
  const caseRows = results.map((result) => ({
    case_key: result.case.id,
    category: result.case.category,
    input_json: {
      ...result.case.input,
      materialSet: knowledge.suite.materialSet,
    },
    expected_json: result.case.expected,
    active: true,
  }));
  await requireOkJson(
    await supabaseRest(supabase, "ai_eval_cases?on_conflict=case_key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(caseRows),
    }),
    "evaluation case upsert",
  );

  const parameters = new URLSearchParams({
    select: "id,case_key",
    case_key: `in.(${results.map((result) => `\"${result.case.id}\"`).join(",")})`,
  });
  const storedCases = await requireOkJson(
    await supabaseRest(supabase, `ai_eval_cases?${parameters}`),
    "evaluation case lookup",
  );
  const ids = new Map(storedCases.map((row) => [row.case_key, row.id]));
  const runRows = results.map((result) => ({
    case_id: ids.get(result.case.id),
    configuration_json: {
      materialSet: knowledge.suite.materialSet,
      materialVersion: knowledge.suite.version,
      evaluator: "portfolio-production-v1",
      productionOrigin: production.origin,
      includesGeneration: result.generation !== null,
    },
    actual_json: {
      retrieval: {
        checks: result.retrieval.checks,
        failures: result.retrieval.failures,
        citationTitles: result.citationTitles,
        lowConfidence: result.lowConfidence,
        conflict: result.conflict,
      },
      ...(result.generation && {
        generation: {
          checks: result.generation.checks,
          failures: result.generation.failures,
          citationTitles: result.generationCitationTitles,
        },
      }),
    },
    passed: result.passed,
    score: result.score,
    notes: result.passed
      ? "portfolio_first_party production evaluation passed"
      : `portfolio_first_party failures: ${[
          ...result.retrieval.failures,
          ...(result.generation?.failures ?? []),
        ].join(",")}`,
  }));
  if (runRows.some((row) => !row.case_id)) {
    throw new Error(
      "evaluation case persistence returned an incomplete id set",
    );
  }
  const storedRuns = await requireOkJson(
    await supabaseRest(supabase, "ai_eval_runs", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify(runRows),
    }),
    "evaluation run insert",
  );
  if (storedRuns.length !== results.length) {
    throw new Error("evaluation run persistence count mismatch");
  }
  return storedRuns.map((row) => row.id);
}

try {
  const sources = await publishedSources();
  const results = [];
  for (const evaluationCase of knowledge.suite.cases) {
    const response = await productionPost(
      "/api/knowledge/search",
      evaluationCase.input,
    );
    const retrievalPayload = portfolioKnowledgeSearchResultSchema.parse(
      await playwrightJson(response, `knowledge search ${evaluationCase.id}`),
    );
    const retrieval = evaluatePortfolioRetrieval(
      evaluationCase,
      retrievalPayload,
    );

    let generation = null;
    let generationCitationTitles = [];
    if (evaluationCase.generation) {
      const generationResponse = await productionPost(
        "/api/chat",
        {
          message: `请先检索已发布的小智作品集说明，再回答：${evaluationCase.input.query}`,
          debug: true,
        },
        120_000,
      );
      const generated = summarizeGeneration(
        await parseSse({
          ok: generationResponse.ok(),
          status: generationResponse.status(),
          text: () => generationResponse.text(),
        }),
      );
      generation = evaluatePortfolioGeneration(evaluationCase, generated);
      generationCitationTitles = generated.citations.map((item) => item.title);
    }
    const scores = [retrieval.score, ...(generation ? [generation.score] : [])];
    results.push({
      case: evaluationCase,
      retrieval,
      generation,
      citationTitles: retrievalPayload.citations.map((item) => item.title),
      generationCitationTitles,
      lowConfidence: retrievalPayload.lowConfidence,
      conflict: retrievalPayload.conflict,
      passed: retrieval.passed && (!generation || generation.passed),
      score: scores.reduce((sum, value) => sum + value, 0) / scores.length,
    });
  }

  const runIds = await persistRuns(results);
  const passedCount = results.filter((result) => result.passed).length;
  const failed = results
    .filter((result) => !result.passed)
    .map((result) => ({
      id: result.case.id,
      retrieval: result.retrieval.failures,
      generation: result.generation?.failures ?? [],
    }));
  console.log(
    JSON.stringify({
      materialSet: knowledge.suite.materialSet,
      materialVersion: knowledge.suite.version,
      publishedMaterials: sources.length,
      cases: results.length,
      generationCases: results.filter((result) => result.generation).length,
      passed: passedCount,
      failed,
      runIds,
    }),
  );
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
