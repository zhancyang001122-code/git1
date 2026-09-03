import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  canonicalXiaohongshuUrl,
  createPolicyApprovalDecisions,
  normalizedDedupeKey,
  requireCompleteReviewDecisions,
  sanitizePublicText,
  sha256,
} from "./lib/social-housing-pipeline.mjs";

const DEFAULT_REVIEW_DIR =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-v2\\cumulative";
const CRAWLER_REVISION = "d6f7c5bb906b6dac40ddf343ef9e26438a3de092";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function loadLocalEnvironment() {
  const text = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const coordinateSchema = z.object({
  formattedAddress: z.string().min(1),
  district: z.string().nullable(),
  amapLongitude: z.number().finite(),
  amapLatitude: z.number().finite(),
  longitude: z.number().finite(),
  latitude: z.number().finite(),
  geocodeLevel: z.string().min(1),
});

const reviewRecordSchema = z
  .object({
    sourceId: z.string().regex(/^[0-9a-f]{24}$/iu),
    title: z.string().min(1).max(80),
    summary: z.string().min(1).max(220),
    city: z.literal("杭州"),
    district: z.string().nullable(),
    community: z.string().nullable(),
    address: z.string().nullable(),
    priceMinMonthly: z.number().int().positive(),
    priceMaxMonthly: z.number().int().positive().nullable(),
    rentType: z.enum(["整租", "合租"]).nullable(),
    layout: z.string().nullable(),
    areaSqm: z.number().positive().nullable(),
    confidence: z.number().min(0).max(1),
    platform: z.literal("xiaohongshu"),
    canonicalUrl: z.string().url(),
    sourcePublishedAt: z.iso.datetime(),
    sourceKeyword: z.string().min(1).max(120),
    lastCheckedAt: z.iso.datetime(),
    rawPayloadHash: z.string().regex(/^[0-9a-f]{64}$/u),
    geocode: coordinateSchema,
    availabilityStatus: z.literal("not_obviously_closed"),
    reviewStatus: z.literal("pending_review"),
  })
  .passthrough();

const decisionsSchema = z.object({
  reviewedAt: z.iso.datetime(),
  reviewer: z.string().min(1).max(100),
  decisions: z.array(
    z.object({
      sourceId: z.string().regex(/^[0-9a-f]{24}$/iu),
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().min(1).max(500),
    }),
  ),
});

const metadataSchema = z.object({
  generatedAt: z.iso.datetime(),
  model: z.string().min(1),
  inputCount: z.number().int().nonnegative(),
  recentCount: z.number().int().nonnegative(),
  inputSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  keywords: z.array(z.string().min(1).max(120)).min(1).max(20).optional(),
});

function bedroomsFromLayout(layout) {
  if (!layout) return null;
  const arabic = layout.match(/(\d{1,2})\s*室/u);
  if (arabic) return Number(arabic[1]);
  const chinese = layout.match(/([一二三四五六七八九十])\s*室/u);
  if (!chinese) return null;
  const values = new Map([
    ["一", 1],
    ["二", 2],
    ["三", 3],
    ["四", 4],
    ["五", 5],
    ["六", 6],
    ["七", 7],
    ["八", 8],
    ["九", 9],
    ["十", 10],
  ]);
  return values.get(chinese[1]) ?? null;
}

const reviewDir = option("--review-dir", DEFAULT_REVIEW_DIR);
const apply = process.argv.includes("--apply");
const autoApprove = process.argv.includes("--auto-approve");
const approvalMethod = option(
  "--approval-method",
  autoApprove ? "policy-approved" : "human-reviewed",
);
if (!/^[a-z][a-z0-9-]{1,30}$/u.test(approvalMethod)) {
  throw new Error("--approval-method must be a lowercase audit label");
}
const [recordsText, metadataText] = await Promise.all([
  readFile(resolve(reviewDir, "review-records.jsonl"), "utf8"),
  readFile(resolve(reviewDir, "batch-metadata.json"), "utf8"),
]);
const records = recordsText
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const decisions = autoApprove
  ? decisionsSchema.parse(
      createPolicyApprovalDecisions(
        records,
        option("--reviewer", "automated-policy-v2"),
      ),
    )
  : decisionsSchema.parse(
      JSON.parse(
        await readFile(resolve(reviewDir, "manual-decisions.json"), "utf8"),
      ),
    );
if (autoApprove) {
  await writeFile(
    resolve(reviewDir, "auto-decisions.json"),
    `${JSON.stringify(decisions, null, 2)}\n`,
    "utf8",
  );
}
const metadata = metadataSchema.parse(JSON.parse(metadataText));
requireCompleteReviewDecisions(records, decisions.decisions);
const byId = new Map(records.map((record) => [record.sourceId, record]));
const approved = decisions.decisions
  .filter((decision) => decision.decision === "approved")
  .map((decision) => {
    const record = reviewRecordSchema.parse(byId.get(decision.sourceId));
    if (record.canonicalUrl !== canonicalXiaohongshuUrl(record.sourceId)) {
      throw new Error(`Source ${record.sourceId} has a non-canonical URL`);
    }
    if (
      sanitizePublicText(record.title, 80) !== record.title ||
      sanitizePublicText(record.summary, 220) !== record.summary
    ) {
      throw new Error(`Source ${record.sourceId} contains contact details`);
    }
    return { decision, record };
  });

console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    reviewed: decisions.decisions.length,
    approved: approved.length,
    rejected: decisions.decisions.filter(
      (decision) => decision.decision === "rejected",
    ).length,
  }),
);
if (!apply) process.exit(0);

await loadLocalEnvironment();
const client = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SECRET_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const batchKeywords =
  metadata.keywords ??
  [...new Set(approved.map(({ record }) => record.sourceKeyword))].slice(0, 20);
if (batchKeywords.length === 0) {
  throw new Error("The ingestion batch does not contain any source keywords");
}
const batchPayload = {
  platform: "xiaohongshu",
  keywords: batchKeywords,
  crawler_name: "MediaCrawler",
  crawler_revision: CRAWLER_REVISION,
  raw_count: metadata.inputCount,
  processed_count: metadata.recentCount,
  approved_count: approved.length,
  content_checksum: metadata.inputSha256,
  status: "processing",
  collected_at: metadata.generatedAt,
};
const batchResult = await client
  .from("social_housing_ingest_batches")
  .upsert(batchPayload, { onConflict: "platform,content_checksum" })
  .select("id")
  .single();
if (batchResult.error) throw new Error("Could not save ingestion batch");

try {
  for (const { record } of approved) {
    const leadResult = await client
      .from("social_housing_leads")
      .upsert(
        {
          dedupe_key: sha256(normalizedDedupeKey(record)),
          title: record.title,
          summary: record.summary,
          city: record.city,
          district: record.district ?? record.geocode.district,
          community: record.community,
          address: record.address ?? record.geocode.formattedAddress,
          price_min_monthly: record.priceMinMonthly,
          price_max_monthly: record.priceMaxMonthly,
          rent_type: record.rentType,
          layout: record.layout,
          bedrooms: bedroomsFromLayout(record.layout),
          area_sqm: record.areaSqm,
          longitude: record.geocode.longitude,
          latitude: record.geocode.latitude,
          amap_longitude: record.geocode.amapLongitude,
          amap_latitude: record.geocode.amapLatitude,
          first_published_at: record.sourcePublishedAt,
          last_seen_at: record.lastCheckedAt,
          review_status: "approved",
          availability_status: record.availabilityStatus,
          extraction_confidence: record.confidence,
          reviewed_at: decisions.reviewedAt,
        },
        { onConflict: "dedupe_key" },
      )
      .select("id")
      .single();
    if (leadResult.error) throw new Error("Could not save an approved lead");

    const sourceResult = await client
      .from("social_housing_lead_sources")
      .upsert(
        {
          lead_id: leadResult.data.id,
          batch_id: batchResult.data.id,
          platform: record.platform,
          platform_post_id: record.sourceId,
          canonical_url: record.canonicalUrl,
          source_keyword: record.sourceKeyword,
          source_published_at: record.sourcePublishedAt,
          collected_at: metadata.generatedAt,
          last_checked_at: record.lastCheckedAt,
          source_status: record.availabilityStatus,
          raw_payload_hash: record.rawPayloadHash,
          extractor_version: `${metadata.model}-structured-v2-${approvalMethod}`,
        },
        { onConflict: "platform,platform_post_id" },
      );
    if (sourceResult.error) throw new Error("Could not save a lead source");
  }
  const completed = await client
    .from("social_housing_ingest_batches")
    .update({ status: "processed", failure_reason: null })
    .eq("id", batchResult.data.id);
  if (completed.error) throw new Error("Could not complete ingestion batch");
} catch (error) {
  await client
    .from("social_housing_ingest_batches")
    .update({ status: "failed", failure_reason: "Idempotent import failed" })
    .eq("id", batchResult.data.id);
  throw error;
}

console.log(`Imported ${approved.length} approved social housing leads.`);
