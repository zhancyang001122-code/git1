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
import {
  publicationImportAction,
  runIndexWorkerUntil,
} from "./lib/portfolio-import-state.mjs";

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
      "id,version_label,status,source_reference,kb_articles!kb_article_versions_article_id_fkey!inner(title,status,current_version_id)",
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

async function findIndexJob(versionId) {
  const parameters = new URLSearchParams({
    select:
      "id,candidate_id,version_id,previous_version_id,status,attempt_count,max_attempts,available_at,last_error_code,result_json",
    version_id: `eq.${versionId}`,
    limit: "1",
  });
  const rows = await requireOkJson(
    await supabaseRest(supabase, `knowledge_index_jobs?${parameters}`),
    "index job lookup",
  );
  return rows[0] ?? null;
}

async function enqueueIndexJob(versionId, job) {
  const response = await supabaseRest(
    supabase,
    "rpc/enqueue_knowledge_index_job",
    {
      method: "POST",
      body: JSON.stringify({
        p_candidate_id: job?.candidate_id ?? null,
        p_version_id: versionId,
        p_previous_version_id: job?.previous_version_id ?? null,
      }),
    },
  );
  const rows = await requireOkJson(response, "index job enqueue");
  if (!rows[0]?.id)
    throw new Error(`index enqueue returned no job for ${versionId}`);
  return rows[0];
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
  return runIndexWorkerUntil({
    versionId,
    readJob: findIndexJob,
    invokeWorker: () => post("/api/internal/knowledge-index-worker", {}),
    wait: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  });
}

const summary = [];
try {
  for (const material of knowledge.materials) {
    const existing = await findPublishedVersion(material);
    if (existing) {
      const job = await findIndexJob(existing.id);
      const action = publicationImportAction(existing, job);
      if (action.action === "inconsistent") {
        throw new Error(
          `published material ${material.id} is not the current searchable version`,
        );
      }
      if (action.action === "resume") {
        await enqueueIndexJob(existing.id, job);
        const worker = await runWorkerUntil(existing.id);
        summary.push({
          id: material.id,
          status: "resumed_and_indexed",
          versionId: existing.id,
          evaluationStatus: worker.finalization.evaluationStatus,
        });
        continue;
      }
      summary.push({
        id: material.id,
        status: "already_published",
        versionId: existing.id,
        evaluationStatus: action.evaluationStatus,
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
