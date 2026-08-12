import { chromium } from "@playwright/test";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() || required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseSecret =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  required("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = required("CRON_SECRET");
const deploymentUrl = (
  process.env.DEPLOYMENT_URL?.trim() || "https://xiaozhi.zaneyang.xyz"
).replace(/\/$/, "");
const proxyServer = process.env.DEPLOYMENT_PROXY_SERVER?.trim();
const demoVersionIds = [
  "62000000-0000-0000-0000-000000000001",
  "62000000-0000-0000-0000-000000000002",
  "62000000-0000-0000-0000-000000000003",
  "62000000-0000-0000-0000-000000000004",
];

async function enqueueDemoVersion(versionId) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/enqueue_knowledge_index_job`,
    {
      method: "POST",
      headers: {
        apikey: supabaseSecret,
        authorization: `Bearer ${supabaseSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_candidate_id: null,
        p_version_id: versionId,
        p_previous_version_id: null,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Demo version enqueue failed with HTTP ${response.status}`);
  }
}

await Promise.all(demoVersionIds.map(enqueueDemoVersion));
console.log("PASS queued 4 explicitly demo-marked knowledge versions");

const browser = await chromium.launch({
  ...(proxyServer && { proxy: { server: proxyServer } }),
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(deploymentUrl, { waitUntil: "domcontentloaded" });
  const completed = new Set();

  for (let run = 1; run <= 8 && completed.size < demoVersionIds.length; run++) {
    const result = await page.evaluate(
      async ({ secret }) => {
        const response = await fetch("/api/internal/knowledge-index-worker", {
          headers: { authorization: `Bearer ${secret}` },
        });
        const body = await response.json();
        return { statusCode: response.status, body };
      },
      { secret: cronSecret },
    );
    if (result.statusCode !== 200) {
      throw new Error(
        `Knowledge index worker failed with HTTP ${result.statusCode}: ${String(result.body?.error?.code ?? "UNKNOWN")}`,
      );
    }
    if (result.body.status === "failed") {
      throw new Error(
        `Knowledge index worker failed with ${String(result.body.errorCode)}`,
      );
    }
    if (
      result.body.status === "succeeded" &&
      demoVersionIds.includes(result.body.versionId)
    ) {
      completed.add(result.body.versionId);
    }
    console.log(`PASS worker run ${run}: ${String(result.body.status)}`);
    if (result.body.status === "retrying") {
      await new Promise((resolve) => setTimeout(resolve, 10_500));
    }
  }

  if (completed.size !== demoVersionIds.length) {
    throw new Error(
      `Only ${completed.size}/${demoVersionIds.length} demo versions completed`,
    );
  }
  console.log("PASS all 4 demo versions have real ready embeddings");
  await context.close();
} finally {
  await browser.close();
}
