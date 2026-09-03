import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { z } from "zod";

import {
  dedupeCandidates,
  sha256,
  sourceIdentityKey,
} from "./lib/social-housing-pipeline.mjs";

const DEFAULT_DATA_ROOT =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-v2";

const batchMetadataSchema = z.object({
  generatedAt: z.iso.datetime(),
  model: z.string().min(1),
  inputCount: z.number().int().nonnegative(),
  recentCount: z.number().int().nonnegative(),
  keywords: z.array(z.string().min(1).max(120)).min(1).max(20),
});

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function findFiles(directory, targetName) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory())
      matches.push(...(await findFiles(path, targetName)));
    else if (entry.isFile() && basename(path) === targetName)
      matches.push(path);
  }
  return matches;
}

const dataRoot = resolve(option("--data-root", DEFAULT_DATA_ROOT));
const runsRoot = resolve(dataRoot, "runs");
const outputRoot = resolve(dataRoot, "cumulative");
const files = await findFiles(runsRoot, "review-records.jsonl");
const records = [];
const batchMetadata = [];
for (const file of files) {
  batchMetadata.push(
    batchMetadataSchema.parse(
      JSON.parse(
        await readFile(resolve(dirname(file), "batch-metadata.json"), "utf8"),
      ),
    ),
  );
  const text = await readFile(file, "utf8");
  for (const line of text.split(/\r?\n/u).filter(Boolean)) {
    records.push(JSON.parse(line));
  }
}

const bySource = new Map();
for (const record of records) {
  const key = sourceIdentityKey(record.platform, record.sourceId);
  const existing = bySource.get(key);
  if (
    !existing ||
    new Date(record.lastCheckedAt) >= new Date(existing.lastCheckedAt)
  ) {
    bySource.set(key, record);
  }
}
const latestRecords = [...bySource.values()];
const pending = latestRecords.filter(
  (record) => record.reviewStatus === "pending_review",
);
const uniquePending = dedupeCandidates(pending);
const releaseText =
  uniquePending.map((record) => JSON.stringify(record)).join("\n") +
  (uniquePending.length > 0 ? "\n" : "");
const models = [...new Set(batchMetadata.map((metadata) => metadata.model))];
if (models.length !== 1) {
  throw new Error("Cumulative release requires exactly one extraction model");
}
const releaseMetadata = {
  generatedAt: new Date().toISOString(),
  model: models[0],
  inputCount: batchMetadata.reduce(
    (total, metadata) => total + metadata.inputCount,
    0,
  ),
  recentCount: batchMetadata.reduce(
    (total, metadata) => total + metadata.recentCount,
    0,
  ),
  inputSha256: sha256(releaseText),
  keywords: [
    ...new Set(batchMetadata.flatMap((metadata) => metadata.keywords)),
  ].slice(0, 20),
};
const statusCounts = Object.fromEntries(
  [...new Set(latestRecords.map((record) => record.reviewStatus))]
    .sort()
    .map((status) => [
      status,
      latestRecords.filter((record) => record.reviewStatus === status).length,
    ]),
);
const summary = {
  generatedAt: new Date().toISOString(),
  reviewFileCount: files.length,
  processedRecordCount: records.length,
  uniqueSourceCount: latestRecords.length,
  statusCounts,
  pendingBeforeListingDedupe: pending.length,
  qualifiedUniqueCandidateCount: uniquePending.length,
};

await mkdir(outputRoot, { recursive: true });
await writeFile(
  resolve(outputRoot, "pending-review.jsonl"),
  releaseText,
  "utf8",
);
await writeFile(
  resolve(outputRoot, "review-records.jsonl"),
  releaseText,
  "utf8",
);
await writeFile(
  resolve(outputRoot, "batch-metadata.json"),
  `${JSON.stringify(releaseMetadata, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(outputRoot, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));
