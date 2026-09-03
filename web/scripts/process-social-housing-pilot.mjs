import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import OpenAI from "openai";
import { z } from "zod";

import {
  canonicalXiaohongshuUrl,
  dedupeCandidates,
  eligibilityFailureReasons,
  gcj02ToWgs84,
  mapWithConcurrency,
  normalizedLocationCacheKey,
  prefilterRentalPost,
  sanitizePublicText,
  selectPreferredDistrict,
  sha256,
  sourceIdentityKey,
} from "./lib/social-housing-pipeline.mjs";

const DEFAULT_INPUT =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-pilot\\xhs\\jsonl\\search_contents_2026-09-03.jsonl";
const DEFAULT_OUTPUT_DIR =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-pilot\\review";
const DEFAULT_CACHE_DIR =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-v2\\cache";
const SOURCE_PLATFORM = "xiaohongshu";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function integerOption(name, fallback, minimum, maximum) {
  const value = Number(option(name, String(fallback)));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function parseJsonLines(text, schema, label) {
  const values = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      values.push(schema.parse(JSON.parse(line)));
    } catch (error) {
      process.stderr.write(
        `${label} ignored invalid line ${index + 1}: ${error instanceof Error ? error.message : "invalid JSON"}\n`,
      );
    }
  }
  return values;
}

function safeErrorMessage(error) {
  return String(error instanceof Error ? error.message : error).slice(0, 500);
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

const rawRowSchema = z
  .object({
    note_id: z.string().regex(/^[0-9a-f]{24}$/iu),
    title: z.string().default(""),
    desc: z.string().default(""),
    time: z.union([z.number(), z.string()]),
    source_keyword: z.string().min(1).max(200),
  })
  .passthrough();

const classificationCacheEntrySchema = z
  .object({
    key: z.string().min(1),
    model: z.string().min(1),
    payloadHash: z.string().regex(/^[0-9a-f]{64}$/u),
    classifiedAt: z.iso.datetime(),
    record: extractedRecordSchema,
  })
  .strict();

const classificationFailureSchema = z
  .object({
    key: z.string().min(1),
    failedAt: z.iso.datetime(),
    error: z.string().min(1).max(500),
  })
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
  const actual = new Set(parsed.records.map((record) => record.sourceId));
  if (
    parsed.records.length !== rows.length ||
    actual.size !== expected.size ||
    parsed.records.some((record) => !expected.has(record.sourceId)) ||
    [...expected].some((sourceId) => !actual.has(sourceId))
  ) {
    throw new Error("Qwen extraction result did not preserve the input ids");
  }
  return parsed.records;
}

function classificationPayloadHash(row) {
  return sha256(
    JSON.stringify({
      sourceId: row.note_id,
      title: sanitizePublicText(row.title, 120),
      content: sanitizePublicText(row.desc, 1_500),
      publishedAt: new Date(Number(row.time)).toISOString(),
    }),
  );
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

const normalizedGeocodeSchema = z
  .object({
    formattedAddress: z.string().min(1),
    district: z.string().nullable(),
    amapLongitude: z.number().finite(),
    amapLatitude: z.number().finite(),
    longitude: z.number().finite(),
    latitude: z.number().finite(),
    geocodeLevel: z.string().min(1),
  })
  .strict();

const geocodeCacheEntrySchema = z
  .object({
    key: z.string().min(1),
    cachedAt: z.iso.datetime(),
    geocode: normalizedGeocodeSchema,
  })
  .strict();

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
const cacheDir = option("--cache-dir", DEFAULT_CACHE_DIR);
const asOf = new Date(option("--as-of", new Date().toISOString()));
if (Number.isNaN(asOf.getTime()))
  throw new Error("--as-of must be an ISO date");
const qwenConcurrency = integerOption("--qwen-concurrency", 2, 1, 3);
const geocodeConcurrency = integerOption("--geocode-concurrency", 2, 1, 3);
const cutoff = new Date(asOf.getTime() - 120 * 24 * 60 * 60 * 1_000);
const model = required("DASHSCOPE_MODEL");
const client = new OpenAI({
  apiKey: required("DASHSCOPE_API_KEY"),
  baseURL: required("DASHSCOPE_BASE_URL"),
  timeout: 60_000,
  maxRetries: 1,
});
const amapKey = required("AMAP_WEB_SERVICE_KEY");

await Promise.all([
  mkdir(outputDir, { recursive: true }),
  mkdir(cacheDir, { recursive: true }),
]);
const sourceText = await readFile(inputPath, "utf8");
const rawRows = sourceText
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => rawRowSchema.parse(JSON.parse(line)));
const uniqueRows = [
  ...new Map(
    rawRows.map((row) => [
      sourceIdentityKey(SOURCE_PLATFORM, row.note_id),
      row,
    ]),
  ).values(),
];
const recentRows = uniqueRows.filter((row) => {
  const publishedAt = new Date(Number(row.time));
  return publishedAt >= cutoff && publishedAt <= asOf;
});
const prefilterResults = recentRows.map((row) => ({
  row,
  result: prefilterRentalPost(row),
}));
const rowsForClassification = prefilterResults
  .filter(({ result }) => result.pass)
  .map(({ row }) => row);
const prefilterRejections = prefilterResults
  .filter(({ result }) => !result.pass)
  .map(({ row, result }) => ({
    platform: SOURCE_PLATFORM,
    sourceId: row.note_id,
    sourceKeyword: sanitizePublicText(row.source_keyword, 120),
    sourcePublishedAt: new Date(Number(row.time)).toISOString(),
    rawPayloadHash: sha256(JSON.stringify(row)),
    reason: result.reason,
  }));

const classificationCachePath = resolve(cacheDir, "classification-cache.jsonl");
const classificationCache = parseJsonLines(
  await readOptionalText(classificationCachePath),
  classificationCacheEntrySchema,
  "Classification cache",
);
const cachedClassifications = new Map(
  classificationCache.map((entry) => [entry.key, entry]),
);
const extractedByKey = new Map();
const rowsToClassify = [];
let reusedClassificationCount = 0;
for (const row of rowsForClassification) {
  const key = sourceIdentityKey(SOURCE_PLATFORM, row.note_id);
  const cached = cachedClassifications.get(key);
  if (
    cached?.model === model &&
    cached.payloadHash === classificationPayloadHash(row)
  ) {
    extractedByKey.set(key, cached.record);
    reusedClassificationCount += 1;
  } else {
    rowsToClassify.push(row);
  }
}

let classificationCheckpointWrite = Promise.resolve();
const classificationFailures = [];
const classificationBatches = [];
for (let index = 0; index < rowsToClassify.length; index += 5) {
  classificationBatches.push(rowsToClassify.slice(index, index + 5));
}
const classificationResults = await mapWithConcurrency(
  classificationBatches,
  qwenConcurrency,
  async (batch, batchIndex) => {
    try {
      const records = await extractBatch(client, model, batch, asOf);
      const rowsById = new Map(batch.map((row) => [row.note_id, row]));
      const entries = records.map((record) => {
        const row = rowsById.get(record.sourceId);
        return classificationCacheEntrySchema.parse({
          key: sourceIdentityKey(SOURCE_PLATFORM, record.sourceId),
          model,
          payloadHash: classificationPayloadHash(row),
          classifiedAt: new Date().toISOString(),
          record,
        });
      });
      classificationCheckpointWrite = classificationCheckpointWrite.then(() =>
        appendFile(
          classificationCachePath,
          `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
          "utf8",
        ),
      );
      await classificationCheckpointWrite;
      process.stdout.write(
        `Classified batch ${batchIndex + 1}/${classificationBatches.length}\n`,
      );
      return { ok: true, entries };
    } catch (error) {
      const failedAt = new Date().toISOString();
      return {
        ok: false,
        failures: batch.map((row) =>
          classificationFailureSchema.parse({
            key: sourceIdentityKey(SOURCE_PLATFORM, row.note_id),
            failedAt,
            error: safeErrorMessage(error),
          }),
        ),
      };
    }
  },
);
await classificationCheckpointWrite;
for (const result of classificationResults) {
  if (result.ok) {
    for (const entry of result.entries) {
      extractedByKey.set(entry.key, entry.record);
    }
  } else {
    classificationFailures.push(...result.failures);
  }
}
const extracted = rowsForClassification
  .map((row) =>
    extractedByKey.get(sourceIdentityKey(SOURCE_PLATFORM, row.note_id)),
  )
  .filter(Boolean);

await writeFile(
  resolve(outputDir, "classified-checkpoint.json"),
  `${JSON.stringify(
    {
      inputSha256: sha256(sourceText),
      generatedAt: asOf.toISOString(),
      model,
      reusedCount: reusedClassificationCount,
      failedCount: classificationFailures.length,
      records: extracted,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  resolve(outputDir, "classification-failures.jsonl"),
  classificationFailures.map((failure) => JSON.stringify(failure)).join("\n") +
    (classificationFailures.length > 0 ? "\n" : ""),
  "utf8",
);
await writeFile(
  resolve(outputDir, "prefilter-rejections.jsonl"),
  prefilterRejections.map((record) => JSON.stringify(record)).join("\n") +
    (prefilterRejections.length > 0 ? "\n" : ""),
  "utf8",
);

const rawByKey = new Map(
  uniqueRows.map((row) => [
    sourceIdentityKey(SOURCE_PLATFORM, row.note_id),
    row,
  ]),
);
const geocodeCachePath = resolve(cacheDir, "geocode-cache.jsonl");
const geocodeCache = parseJsonLines(
  await readOptionalText(geocodeCachePath),
  geocodeCacheEntrySchema,
  "Geocode cache",
);
const cachedGeocodes = new Map(
  geocodeCache.map((entry) => [entry.key, entry.geocode]),
);
const geocodeInFlight = new Map();
let geocodeCheckpointWrite = Promise.resolve();
let reusedGeocodeCount = 0;

async function resolveCachedGeocode(record, locationQuery, cacheKey) {
  const cached = cachedGeocodes.get(cacheKey);
  if (cached) return { geocode: cached, reused: true };

  const existingRequest = geocodeInFlight.get(cacheKey);
  if (existingRequest) {
    return { geocode: await existingRequest, reused: true };
  }

  const request = (async () => {
    let geocode = await placeSearchLocation(
      amapKey,
      locationQuery,
      record.district,
    );
    geocode ??= await geocodeLocation(
      amapKey,
      `杭州市${record.district ?? ""}${locationQuery}`,
    );
    if (!geocode) return null;

    const entry = geocodeCacheEntrySchema.parse({
      key: cacheKey,
      cachedAt: new Date().toISOString(),
      geocode,
    });
    cachedGeocodes.set(cacheKey, geocode);
    geocodeCheckpointWrite = geocodeCheckpointWrite.then(() =>
      appendFile(geocodeCachePath, `${JSON.stringify(entry)}\n`, "utf8"),
    );
    await geocodeCheckpointWrite;
    return geocode;
  })();
  geocodeInFlight.set(cacheKey, request);
  try {
    return { geocode: await request, reused: false };
  } finally {
    geocodeInFlight.delete(cacheKey);
  }
}

const geocodedRecords = await mapWithConcurrency(
  extracted,
  geocodeConcurrency,
  async (record) => {
    const failureReasons = eligibilityFailureReasons(record, asOf);
    if (failureReasons.length > 0) {
      return { record, failureReasons, geocode: null, geocodeError: null };
    }
    const locationQuery =
      record.community?.trim() || record.locationText?.trim();
    if (!locationQuery) {
      return {
        record,
        failureReasons: ["缺少可用于定位的小区、地标或地铁站"],
        geocode: null,
        geocodeError: null,
      };
    }
    const cacheKey = normalizedLocationCacheKey(record);
    try {
      const { geocode, reused } = await resolveCachedGeocode(
        record,
        locationQuery,
        cacheKey,
      );
      if (reused) reusedGeocodeCount += 1;
      return { record, failureReasons, geocode, geocodeError: null };
    } catch (error) {
      return {
        record,
        failureReasons,
        geocode: null,
        geocodeError: safeErrorMessage(error),
      };
    }
  },
);
await geocodeCheckpointWrite;

const reviewed = [];
for (const item of geocodedRecords) {
  const { record, geocode, geocodeError } = item;
  const raw = rawByKey.get(sourceIdentityKey(SOURCE_PLATFORM, record.sourceId));
  if (!raw) throw new Error(`Missing raw row for ${record.sourceId}`);
  const failureReasons = [...item.failureReasons];
  const eligible = failureReasons.length === 0;
  const extractionWarnings = [...record.rejectionReasons];
  const rejectionReasons = [...failureReasons];
  if (eligible && !geocode) rejectionReasons.push("地点无法可靠地理编码");
  if (geocodeError) extractionWarnings.push(`高德请求失败：${geocodeError}`);
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
    platform: SOURCE_PLATFORM,
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
  sourcePlatform: SOURCE_PLATFORM,
  keywords: [...new Set(rawRows.map((row) => row.source_keyword))].slice(0, 20),
  model,
  inputCount: rawRows.length,
  uniqueCount: uniqueRows.length,
  recentCount: recentRows.length,
  prefilteredCount: prefilterRejections.length,
  prefilterReasons: Object.fromEntries(
    [...new Set(prefilterRejections.map((record) => record.reason))].map(
      (reason) => [
        reason,
        prefilterRejections.filter((record) => record.reason === reason).length,
      ],
    ),
  ),
  classifiedCount: extracted.length,
  reusedClassificationCount,
  classificationFailureCount: classificationFailures.length,
  reusedGeocodeCount,
  qwenConcurrency,
  geocodeConcurrency,
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
