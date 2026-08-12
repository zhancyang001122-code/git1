import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chromium, expect } from "@playwright/test";

function readEnvFile(name) {
  try {
    const line = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    if (!line) return undefined;
    return line
      .slice(name.length + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
  } catch {
    return undefined;
  }
}

function required(name) {
  const value = process.env[name]?.trim() || readEnvFile(name)?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const productionUrl = new URL(
  process.env.PRODUCTION_URL?.trim() || "https://xiaozhi-local-life.vercel.app",
);
if (productionUrl.protocol !== "https:") {
  throw new Error("PRODUCTION_URL must use HTTPS");
}
const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
if (new Set(["127.0.0.1", "localhost", "::1"]).has(supabaseUrl.hostname)) {
  throw new Error("Production intake verification requires remote Supabase");
}
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const adminToken = required("ADMIN_VERIFICATION_TOKEN");
if (adminToken.length < 32) {
  throw new Error(
    "ADMIN_VERIFICATION_TOKEN must contain at least 32 characters",
  );
}

const proxyServer = process.env.DEPLOYMENT_PROXY_SERVER?.trim();
const browser = await chromium.launch({
  ...(proxyServer && { proxy: { server: proxyServer } }),
});
const context = await browser.newContext();
const page = await context.newPage();
const marker = randomUUID();
const question = `[生产验收临时材料] 历史房源时效边界 ${marker}`;
let candidateId;

function restUrl(path) {
  return new URL(`/rest/v1/${path}`, supabaseUrl);
}

async function rest(path, key, init = {}) {
  return fetch(restUrl(path), {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(init.body && { "content-type": "application/json" }),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
}

try {
  await page.goto(new URL("/knowledge-admin/login", productionUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await page.getByLabel("管理口令").fill(adminToken);
  await Promise.all([
    page.waitForURL(/\/knowledge-admin(?:\?|$)/),
    page.getByRole("button", { name: "验证并进入" }).click(),
  ]);

  await expect(
    page.getByRole("heading", { name: "录入正式资料" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "录入" }).click();
  await page.getByLabel("代表问题").fill(question);
  await page.getByLabel("材料标题").fill("生产验收临时材料：历史房源时效边界");
  await page
    .getByLabel("材料正文")
    .fill(
      "这是一条生产链路验收临时材料，只用于验证受控录入；不会批准、发布、索引或参与回答。",
    );
  await page.getByLabel("来源文件或编号").fill(`PROD-SMOKE-${marker}`);
  await page.getByLabel("内容负责人").fill("生产验收脚本");
  await page.getByLabel("版本号").fill("smoke-v1");
  await page.getByLabel("分类标识").fill("production_smoke");
  await page.getByLabel("生效日期").fill("2026-08-12");
  await page.getByLabel("变更说明").fill("验证生产受控材料录入链路");
  await page.getByRole("button", { name: "保存为待审核草稿" }).click();

  await expect(page.getByRole("status")).toContainText("已保存为草稿");
  await expect(page.getByRole("status")).toContainText(
    "尚未发布，也不能被检索",
  );
  const href = await page
    .getByRole("link", { name: "进入审核" })
    .getAttribute("href");
  const match = href?.match(/^\/knowledge-admin\/([0-9a-f-]{36})$/i);
  if (!match?.[1])
    throw new Error("production intake returned no candidate id");
  candidateId = match[1];

  const fields =
    "id,source_type,normalized_question,reason,status,occurrence_count,draft_json";
  const anonymousResponse = await rest(
    `knowledge_candidates?select=${fields}&id=eq.${candidateId}`,
    publishableKey,
  );
  if (anonymousResponse.ok) {
    const rows = await anonymousResponse.json();
    if (Array.isArray(rows) && rows.length > 0) {
      throw new Error("anonymous client read the imported knowledge draft");
    }
  } else if (![401, 403, 404].includes(anonymousResponse.status)) {
    throw new Error(
      `anonymous candidate read returned HTTP ${anonymousResponse.status}`,
    );
  }

  const serviceResponse = await rest(
    `knowledge_candidates?select=${fields}&id=eq.${candidateId}`,
    secretKey,
  );
  if (!serviceResponse.ok) {
    throw new Error(
      `service candidate read returned HTTP ${serviceResponse.status}`,
    );
  }
  const rows = await serviceResponse.json();
  const candidate = rows[0];
  if (
    rows.length !== 1 ||
    candidate.source_type !== "human_correction" ||
    candidate.reason !== "manual_material_intake" ||
    candidate.status !== "drafted" ||
    candidate.normalized_question !== question ||
    candidate.draft_json?.versionLabel !== "smoke-v1"
  ) {
    throw new Error("production intake persisted an invalid candidate draft");
  }

  console.log(
    JSON.stringify({
      candidateId,
      status: candidate.status,
      versionLabel: candidate.draft_json.versionLabel,
      anonymousReadDenied: true,
      searchable: false,
    }),
  );
} finally {
  if (candidateId) {
    const cleanup = await rest(
      `knowledge_candidates?id=eq.${candidateId}`,
      secretKey,
      { method: "DELETE", headers: { prefer: "return=minimal" } },
    );
    if (!cleanup.ok) {
      console.error(`cleanup failed with HTTP ${cleanup.status}`);
      process.exitCode = 1;
    }
  }
  await browser.close();
}
