import { chromium } from "@playwright/test";

import {
  adminHeaders,
  loadPortfolioKnowledge,
  productionUrl,
  proxyConfiguration,
  requiredEnvironment,
  requireOkJson,
  supabaseConfiguration,
  supabaseRest,
} from "./lib/portfolio-knowledge.mjs";

const production = productionUrl();
const supabase = supabaseConfiguration();
const token = requiredEnvironment("ADMIN_VERIFICATION_TOKEN");
const knowledge = loadPortfolioKnowledge();
const browser = await chromium.launch({
  ...(proxyConfiguration() && { proxy: proxyConfiguration() }),
});
const context = await browser.newContext();
const request = context.request;
const headers = adminHeaders(token);

async function findPublishedVersion(material) {
  const parameters = new URLSearchParams({
    select:
      "id,version_label,status,source_reference,kb_articles!inner(title,status)",
    source_reference: `eq.${material.draft.sourceReference}`,
    version_label: `eq.${material.draft.versionLabel}`,
    status: "eq.published",
    limit: "1",
  });
  const response = await supabaseRest(
    supabase,
    `kb_article_versions?${parameters}`,
  );
  const rows = await requireOkJson(response, "published version lookup");
  const row = rows[0];
  if (!row) return null;
  if (
    row.kb_articles?.title !== material.draft.title ||
    row.kb_articles?.status !== "published"
  ) {
    throw new Error(`published material mismatch for ${material.id}`);
  }
  return row;
}

async function post(path, body) {
  const response = await request.post(new URL(path, production).href, {
    headers,
    data: body,
    timeout: 60_000,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok()) {
    const code =
      payload && typeof payload === "object"
        ? payload.error?.code || payload.code
        : undefined;
    throw new Error(
      `${path} returned HTTP ${response.status()}${code ? ` (${code})` : ""}`,
    );
  }
  return payload;
}

async function runWorkerUntil(versionId) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const result = await post("/api/internal/knowledge-index-worker", {});
    if (result.status === "succeeded" && result.versionId === versionId) {
      if (
        result.finalization?.searchable !== true ||
        result.finalization?.evaluationStatus !== "passed"
      ) {
        throw new Error(`index finalization failed for ${versionId}`);
      }
      return result;
    }
    if (result.status === "idle") break;
  }
  throw new Error(`index worker did not complete version ${versionId}`);
}

const summary = [];
try {
  for (const material of knowledge.materials) {
    const existing = await findPublishedVersion(material);
    if (existing) {
      summary.push({
        id: material.id,
        status: "already_published",
        versionId: existing.id,
      });
      continue;
    }

    const created = await post("/api/knowledge/candidates", {
      action: "create_draft",
      material: {
        question: material.question,
        draft: {
          ...material.draft,
          materialKind: "portfolio_first_party",
          answerMarkdown: material.content,
        },
      },
    });
    const candidateId = created.candidate?.id;
    if (!candidateId)
      throw new Error(`candidate id missing for ${material.id}`);

    const reviewed = await post("/api/knowledge/candidates", {
      action: "review",
      review: {
        candidateId,
        decision: "approve",
        notes:
          "作品集首方公开说明；已依据仓库实现、Production 验收记录和公开边界完成复核。",
        draft: {
          ...material.draft,
          materialKind: "portfolio_first_party",
          answerMarkdown: material.content,
        },
      },
    });
    if (reviewed.review?.status !== "approved") {
      throw new Error(`review did not approve ${material.id}`);
    }

    const published = await post("/api/knowledge/publish", { candidateId });
    if (
      published.publicationStatus !== "published" ||
      published.indexStatus !== "queued"
    ) {
      throw new Error(`publication did not queue ${material.id}`);
    }
    const worker = await runWorkerUntil(published.versionId);
    summary.push({
      id: material.id,
      status: "published_and_indexed",
      candidateId,
      versionId: published.versionId,
      evaluationStatus: worker.finalization.evaluationStatus,
    });
  }
  console.log(
    JSON.stringify({
      materialSet: knowledge.manifest.materialSet,
      version: knowledge.manifest.version,
      materials: summary,
    }),
  );
} finally {
  await browser.close();
}
