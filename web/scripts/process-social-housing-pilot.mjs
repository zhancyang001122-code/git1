import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import OpenAI from "openai";
import { z } from "zod";

import {
  canonicalXiaohongshuUrl,
  dedupeCandidates,
  eligibilityFailureReasons,
  gcj02ToWgs84,
  sanitizePublicText,
  selectPreferredDistrict,
  sha256,
} from "./lib/social-housing-pipeline.mjs";

const DEFAULT_INPUT =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-pilot\\xhs\\jsonl\\search_contents_2026-09-03.jsonl";
const DEFAULT_OUTPUT_DIR =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-pilot\\review";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
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

const extractedRecordSchema = z
  .object({
    sourceId: z.string().regex(/^[0-9a-f]{24}$/iu),
    category: z.enum([
      "offering",
      "wanted",
      "advice",
      "commercial",
      "closed",
      "unclear",
    ]),
    title: z.string().min(1).max(80),
    summary: z.string().min(1).max(220),
    city: z.literal("杭州市"),
    district: z.string().max(30).nullable(),
    community: z.string().max(80).nullable(),
    address: z.string().max(120).nullable(),
    locationText: z.string().max(120).nullable(),
    priceMinMonthly: z.number().int().positive().max(100_000).nullable(),
    priceMaxMonthly: z.number().int().positive().max(100_000).nullable(),
    rentType: z.enum(["整租", "合租"]).nullable(),
    layout: z.string().max(30).nullable(),
    areaSqm: z.number().positive().max(2_000).nullable(),
    explicitlyClosed: z.boolean(),
    availabilityDeadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    rejectionReasons: z.array(z.string().max(300)).max(8),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const extractionSchema = z
  .object({ records: z.array(extractedRecordSchema).min(1).max(5) })
  .strict();

const extractionTool = {
  type: "function",
  function: {
    name: "classify_rental_posts",
    description:
      "Classify public social posts and extract only explicitly stated rental-listing fields.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["records"],
      properties: {
        records: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "sourceId",
              "category",
              "title",
              "summary",
              "city",
              "district",
              "community",
              "address",
              "locationText",
              "priceMinMonthly",
              "priceMaxMonthly",
              "rentType",
              "layout",
              "areaSqm",
              "explicitlyClosed",
              "availabilityDeadline",
              "rejectionReasons",
              "confidence",
            ],
            properties: {
              sourceId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
              category: {
                type: "string",
                enum: [
                  "offering",
                  "wanted",
                  "advice",
                  "commercial",
                  "closed",
                  "unclear",
                ],
              },
              title: { type: "string", minLength: 1, maxLength: 80 },
              summary: { type: "string", minLength: 1, maxLength: 220 },
              city: { type: "string", enum: ["杭州市"] },
              district: { type: ["string", "null"], maxLength: 30 },
              community: { type: ["string", "null"], maxLength: 80 },
              address: { type: ["string", "null"], maxLength: 120 },
              locationText: { type: ["string", "null"], maxLength: 120 },
              priceMinMonthly: {
                type: ["integer", "null"],
                minimum: 1,
                maximum: 100000,
              },
              priceMaxMonthly: {
                type: ["integer", "null"],
                minimum: 1,
                maximum: 100000,
              },
              rentType: {
                type: ["string", "null"],
                enum: ["整租", "合租", null],
              },
              layout: { type: ["string", "null"], maxLength: 30 },
              areaSqm: {
                type: ["number", "null"],
                exclusiveMinimum: 0,
                maximum: 2000,
              },
              explicitlyClosed: { type: "boolean" },
              availabilityDeadline: {
                type: ["string", "null"],
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
              rejectionReasons: {
                type: "array",
                maxItems: 8,
                items: { type: "string", maxLength: 300 },
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
};

async function extractBatch(client, model, rows, asOf) {
  const input = rows.map((row) => ({
    sourceId: row.note_id,
    title: sanitizePublicText(row.title, 120),
    content: sanitizePublicText(row.desc, 1_500),
    publishedAt: new Date(Number(row.time)).toISOString(),
    searchKeyword: sanitizePublicText(row.source_keyword, 40),
  }));
  const response = await client.chat.completions.create({
    model,
    enable_thinking: false,
    temperature: 0,
    max_tokens: 3_000,
    messages: [
      {
        role: "system",
        content: `你是租房线索审核器，审核时点为 ${asOf.toISOString()}。只依据帖子明确文字提取，不推测。offering 仅指发布者提供具体房源出租或转租；求租、攻略、吐槽、广告中介、已租出分别标记 wanted/advice/commercial/closed。租金允许精确值或区间：精确值的上下限相同；“1500-1800”保留为上下限。地点可以是小区、明确地标或地铁站。explicitlyClosed 只在原文明确已租出、已结束或明确有效期在审核时点前结束时为 true；相对日期要结合帖子发布时间换算 availabilityDeadline。禁止在 title、summary、address 中保留姓名、昵称、手机号、微信号或其他联系方式。`,
      },
      { role: "user", content: JSON.stringify(input) },
    ],
    tools: [extractionTool],
    tool_choice: {
      type: "function",
      function: { name: extractionTool.function.name },
    },
  });
  const call = response.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.function.name !== extractionTool.function.name) {
    throw new Error("Qwen did not return the forced extraction tool");
  }
  const parsed = extractionSchema.parse(JSON.parse(call.function.arguments));
  const expected = new Set(rows.map((row) => row.note_id));
  if (
    parsed.records.length !== rows.length ||
    parsed.records.some((record) => !expected.has(record.sourceId))
  ) {
    throw new Error("Qwen extraction result did not preserve the input ids");
  }
  return parsed.records;
}

const geocodeSchema = z
  .object({
    status: z.string(),
    info: z.string(),
    infocode: z.string().optional(),
    geocodes: z
      .array(
        z
          .object({
            formatted_address: z.string(),
            province: z.union([z.string(), z.array(z.string())]),
            city: z.union([z.string(), z.array(z.string())]),
            district: z.union([z.string(), z.array(z.string())]),
            location: z.string().regex(/^\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/u),
            level: z.string(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

const placeSearchSchema = z
  .object({
    status: z.string(),
    info: z.string(),
    infocode: z.string().optional(),
    pois: z
      .array(
        z
          .object({
            name: z.string(),
            location: z.string().regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/u),
            pname: z.string().default(""),
            cityname: z.string().default(""),
            adname: z.string().default(""),
            address: z.union([z.string(), z.array(z.string())]).default(""),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

async function placeSearchLocation(amapKey, keywords, preferredDistrict) {
  const url = new URL("https://restapi.amap.com/v5/place/text");
  url.searchParams.set("key", amapKey);
  url.searchParams.set("keywords", keywords.slice(0, 80));
  url.searchParams.set("region", "杭州市");
  url.searchParams.set("city_limit", "true");
  url.searchParams.set("page_size", "10");
  let parsed;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok)
      throw new Error(`AMap place search HTTP ${response.status}`);
    parsed = placeSearchSchema.parse(await response.json());
    if (parsed.infocode !== "10021") break;
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, 1_200 * (attempt + 1)),
    );
  }
  if (!parsed || parsed.status !== "1" || parsed.pois.length === 0) return null;

  const selected = selectPreferredDistrict(
    parsed.pois.map((poi) => ({ ...poi, district: poi.adname || null })),
    preferredDistrict,
  );
  if (!selected) return null;
  const [longitude, latitude] = selected.location.split(",").map(Number);
  const wgs84 = gcj02ToWgs84(longitude, latitude);
  const address = Array.isArray(selected.address) ? "" : selected.address;
  return {
    formattedAddress: [
      selected.pname,
      selected.cityname,
      selected.adname,
      address,
      selected.name,
    ]
      .filter(Boolean)
      .join(""),
    district: selected.adname || null,
    amapLongitude: longitude,
    amapLatitude: latitude,
    longitude: wgs84.longitude,
    latitude: wgs84.latitude,
    geocodeLevel: "兴趣点",
  };
}

async function geocodeLocation(amapKey, locationText) {
  const url = new URL("https://restapi.amap.com/v3/geocode/geo");
  url.searchParams.set("key", amapKey);
  url.searchParams.set("address", locationText);
  url.searchParams.set("city", "杭州");
  let parsed;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`AMap geocode HTTP ${response.status}`);
    parsed = geocodeSchema.parse(await response.json());
    if (parsed.infocode !== "10021") break;
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, 1_200 * (attempt + 1)),
    );
  }
  if (!parsed || parsed.status !== "1" || parsed.geocodes.length === 0) {
    process.stdout.write(
      `AMap skipped one location: ${parsed?.info ?? "invalid response"} (${parsed?.infocode ?? "unknown"})\n`,
    );
    return null;
  }
  const first = parsed.geocodes[0];
  const [longitude, latitude] = first.location.split(",").map(Number);
  const wgs84 = gcj02ToWgs84(longitude, latitude);
  return {
    formattedAddress: first.formatted_address,
    district: Array.isArray(first.district) ? null : first.district || null,
    amapLongitude: longitude,
    amapLatitude: latitude,
    longitude: wgs84.longitude,
    latitude: wgs84.latitude,
    geocodeLevel: first.level,
  };
}

await loadLocalEnvironment();
const inputPath = option("--input", DEFAULT_INPUT);
const outputDir = option("--output-dir", DEFAULT_OUTPUT_DIR);
const asOf = new Date(option("--as-of", new Date().toISOString()));
const cutoff = new Date(asOf.getTime() - 120 * 24 * 60 * 60 * 1_000);
const model = required("DASHSCOPE_MODEL");
const client = new OpenAI({
  apiKey: required("DASHSCOPE_API_KEY"),
  baseURL: required("DASHSCOPE_BASE_URL"),
  timeout: 60_000,
  maxRetries: 1,
});
const amapKey = required("AMAP_WEB_SERVICE_KEY");

const sourceText = await readFile(inputPath, "utf8");
const rawRows = sourceText
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const uniqueRows = [
  ...new Map(rawRows.map((row) => [String(row.note_id), row])).values(),
];
const recentRows = uniqueRows.filter((row) => {
  const publishedAt = new Date(Number(row.time));
  return publishedAt >= cutoff && publishedAt <= asOf;
});

const extracted = [];
if (hasFlag("--reuse-classification")) {
  const checkpoint = JSON.parse(
    await readFile(resolve(outputDir, "classified-checkpoint.json"), "utf8"),
  );
  if (
    checkpoint.inputSha256 !== sha256(sourceText) ||
    checkpoint.model !== model
  ) {
    throw new Error(
      "Classification checkpoint does not match this input or model",
    );
  }
  extracted.push(...z.array(extractedRecordSchema).parse(checkpoint.records));
  process.stdout.write(`Reused ${extracted.length} classified records\n`);
} else {
  for (let index = 0; index < recentRows.length; index += 5) {
    const batch = recentRows.slice(index, index + 5);
    extracted.push(...(await extractBatch(client, model, batch, asOf)));
    process.stdout.write(
      `Classified ${Math.min(index + batch.length, recentRows.length)}/${recentRows.length}\n`,
    );
  }
}

await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, "classified-checkpoint.json"),
  `${JSON.stringify(
    {
      inputSha256: sha256(sourceText),
      generatedAt: asOf.toISOString(),
      model,
      records: extracted,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const rawById = new Map(uniqueRows.map((row) => [String(row.note_id), row]));
const cachedGeocodes = new Map();
if (hasFlag("--reuse-geocodes")) {
  const cachedText = await readFile(
    resolve(outputDir, "review-records.jsonl"),
    "utf8",
  );
  for (const line of cachedText.split(/\r?\n/u).filter(Boolean)) {
    const cached = JSON.parse(line);
    if (cached.geocode) cachedGeocodes.set(cached.sourceId, cached.geocode);
  }
}
const reviewed = [];
for (const record of extracted) {
  const raw = rawById.get(record.sourceId);
  const failureReasons = eligibilityFailureReasons(record, asOf);
  const eligible = failureReasons.length === 0;
  let geocode = null;
  if (eligible) {
    geocode = cachedGeocodes.get(record.sourceId) ?? null;
    if (
      geocode?.district &&
      record.district &&
      geocode.district !== record.district
    ) {
      geocode = null;
    }
    if (!geocode) {
      const locationQuery = record.community ?? record.locationText;
      geocode = await placeSearchLocation(
        amapKey,
        locationQuery,
        record.district,
      );
      geocode ??= await geocodeLocation(
        amapKey,
        `杭州市${record.district ?? ""}${locationQuery}`,
      );
    }
  }
  const extractionWarnings = [...record.rejectionReasons];
  const rejectionReasons = [...failureReasons];
  if (eligible && !geocode) rejectionReasons.push("地点无法可靠地理编码");
  if (geocode && ["省", "市", "区县", "乡镇"].includes(geocode.geocodeLevel)) {
    rejectionReasons.push("地理编码粒度过粗，不能用于距离排序");
  }
  if (
    geocode?.district &&
    record.district &&
    geocode.district !== record.district
  ) {
    extractionWarnings.push(
      `帖子区域“${record.district}”与高德解析“${geocode.district}”不同，需人工核验`,
    );
  }
  const geocodeApproved = Boolean(geocode) && rejectionReasons.length === 0;
  reviewed.push({
    ...record,
    city: "杭州",
    district: geocode?.district ?? record.district,
    title: sanitizePublicText(record.title, 80),
    summary: sanitizePublicText(record.summary, 220),
    address: record.address ? sanitizePublicText(record.address, 120) : null,
    platform: "xiaohongshu",
    sourceId: record.sourceId,
    canonicalUrl: canonicalXiaohongshuUrl(record.sourceId),
    sourcePublishedAt: new Date(Number(raw.time)).toISOString(),
    sourceKeyword: sanitizePublicText(raw.source_keyword, 120),
    lastCheckedAt: asOf.toISOString(),
    rawPayloadHash: sha256(JSON.stringify(raw)),
    geocode,
    availabilityStatus: "not_obviously_closed",
    extractionWarnings,
    reviewStatus:
      eligible && geocodeApproved ? "pending_review" : "rejected_automatically",
    rejectionReasons,
  });
}

const candidates = dedupeCandidates(
  reviewed.filter((record) => record.reviewStatus === "pending_review"),
);
const candidateIds = new Set(candidates.map((record) => record.sourceId));
const finalRecords = reviewed.map((record) =>
  record.reviewStatus === "pending_review" && !candidateIds.has(record.sourceId)
    ? {
        ...record,
        reviewStatus: "rejected_duplicate",
        rejectionReasons: [...record.rejectionReasons, "与更高置信度线索重复"],
      }
    : record,
);

const batchId = crypto.randomUUID();
const metadata = {
  batchId,
  generatedAt: asOf.toISOString(),
  cutoff: cutoff.toISOString(),
  sourcePlatform: "xiaohongshu",
  model,
  inputCount: rawRows.length,
  uniqueCount: uniqueRows.length,
  recentCount: recentRows.length,
  pendingReviewCount: finalRecords.filter(
    (record) => record.reviewStatus === "pending_review",
  ).length,
  rejectedCount: finalRecords.filter(
    (record) => record.reviewStatus !== "pending_review",
  ).length,
  inputSha256: sha256(sourceText),
};

await writeFile(
  resolve(outputDir, "review-records.jsonl"),
  `${finalRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
  "utf8",
);
await writeFile(
  resolve(outputDir, "batch-metadata.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(metadata, null, 2));
