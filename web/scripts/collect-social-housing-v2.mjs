import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  buildKeywordMatrix,
  selectRotatingKeywordBatch,
  sha256,
} from "./lib/social-housing-pipeline.mjs";

const DEFAULT_CRAWLER_ROOT = "C:\\Users\\Administrator\\Tools\\MediaCrawler";
const DEFAULT_DATA_ROOT =
  "C:\\Users\\Administrator\\Tools\\MediaCrawler\\data\\hangzhou-rental-v2";

const keywordConfigurationSchema = z
  .object({
    version: z.number().int().positive(),
    city: z.string().min(1),
    intents: z.array(z.string().min(1)).min(1),
    districts: z
      .array(
        z
          .object({
            district: z.string().min(1),
            communities: z.array(z.string().min(1)).min(1),
            stations: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const stateSchema = z
  .object({
    version: z.literal(1),
    keywordMatrixHash: z.string().length(64).optional(),
    nextIndex: z.number().int().nonnegative(),
    runs: z
      .array(
        z.object({
          runId: z.string().min(1),
          status: z.enum(["running", "completed", "failed"]),
          startIndex: z.number().int().nonnegative(),
          keywords: z.array(z.string().min(1)).min(1).max(20),
          startedAt: z.iso.datetime(),
          completedAt: z.iso.datetime().optional(),
          rawFile: z.string().optional(),
          rawCount: z.number().int().nonnegative().optional(),
          error: z.string().max(500).optional(),
        }),
      )
      .max(100),
  })
  .strict();

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

async function readState(path) {
  try {
    return stateSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, nextIndex: 0, runs: [] };
    throw error;
  }
}

async function saveState(path, state) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(stateSchema.parse(state), null, 2)}\n`,
    "utf8",
  );
}

async function run(command, args, cwd) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      windowsHide: false,
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else
        rejectRun(
          new Error(`MediaCrawler exited with ${code ?? signal ?? "unknown"}`),
        );
    });
  });
}

async function findRawFile(rawRoot) {
  const directory = resolve(rawRoot, "xhs", "jsonl");
  let names;
  try {
    names = (await readdir(directory)).filter((name) =>
      /^search_contents_.*\.jsonl$/u.test(name),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (names.length === 0) return null;
  if (names.length !== 1) {
    throw new Error(
      `Expected one MediaCrawler JSONL file, found ${names.length}`,
    );
  }
  return resolve(directory, names[0]);
}

const crawlerRoot = resolve(option("--crawler-root", DEFAULT_CRAWLER_ROOT));
const dataRoot = resolve(option("--data-root", DEFAULT_DATA_ROOT));
const configurationPath = resolve(
  option(
    "--keyword-config",
    resolve(process.cwd(), "config", "hangzhou-rental-keywords.json"),
  ),
);
const statePath = resolve(dataRoot, "state", "cursor.json");
const batchSize = integerOption("--keyword-count", 4, 1, 12);
const notesPerKeyword = integerOption("--notes-per-keyword", 20, 20, 100);
const preview = process.argv.includes("--preview");

const configuration = keywordConfigurationSchema.parse(
  JSON.parse(await readFile(configurationPath, "utf8")),
);
const keywords = buildKeywordMatrix(configuration);
const state = await readState(statePath);
const keywordMatrixHash = sha256(JSON.stringify(keywords));
if (state.keywordMatrixHash !== keywordMatrixHash) {
  if (state.keywordMatrixHash !== undefined) {
    console.warn("Keyword matrix changed; resetting rotation cursor to 0");
  } else if (state.nextIndex > 0) {
    console.warn(
      "Legacy cursor detected; resetting for the interleaved matrix",
    );
  }
  state.nextIndex = 0;
  state.keywordMatrixHash = keywordMatrixHash;
}
const startIndex = state.nextIndex % keywords.length;
const selectedKeywords = selectRotatingKeywordBatch(
  keywords,
  startIndex,
  batchSize,
);

if (preview) {
  console.log(
    JSON.stringify(
      {
        mode: "preview",
        matrixSize: keywords.length,
        keywordMatrixHash,
        startIndex,
        selectedKeywords,
        nextIndex: (startIndex + selectedKeywords.length) % keywords.length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const pythonPath = resolve(crawlerRoot, ".venv", "Scripts", "python.exe");
await access(pythonPath);
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const runRoot = resolve(dataRoot, "runs", runId);
const rawRoot = resolve(runRoot, "raw");
const runRecord = {
  runId,
  status: "running",
  startIndex,
  keywords: selectedKeywords,
  startedAt: new Date().toISOString(),
};
state.runs = [...state.runs.slice(-98), runRecord];
await saveState(statePath, state);

try {
  await run(
    pythonPath,
    [
      "main.py",
      "--platform",
      "xhs",
      "--lt",
      "qrcode",
      "--type",
      "search",
      "--keywords",
      selectedKeywords.join(","),
      "--start",
      "1",
      "--crawler_max_notes_count",
      String(notesPerKeyword),
      "--max_concurrency_num",
      "1",
      "--get_comment",
      "false",
      "--get_sub_comment",
      "false",
      "--headless",
      "false",
      "--save_data_option",
      "jsonl",
      "--save_data_path",
      rawRoot,
    ],
    crawlerRoot,
  );
  const rawFile = await findRawFile(rawRoot);
  if (!rawFile) throw new Error("MediaCrawler completed without a JSONL file");
  const rawCount = (await readFile(rawFile, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean).length;
  if (rawCount === 0)
    throw new Error("MediaCrawler completed without any records");

  runRecord.status = "completed";
  runRecord.completedAt = new Date().toISOString();
  runRecord.rawFile = rawFile;
  runRecord.rawCount = rawCount;
  state.nextIndex = (startIndex + selectedKeywords.length) % keywords.length;
  await saveState(statePath, state);
  await writeFile(
    resolve(runRoot, "manifest.json"),
    `${JSON.stringify(
      {
        version: 1,
        runId,
        platform: "xiaohongshu",
        keywordConfigurationVersion: configuration.version,
        keywordMatrixHash,
        keywordMatrixSize: keywords.length,
        keywords: selectedKeywords,
        rawFile,
        rawCount,
        completedAt: runRecord.completedAt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      { runId, rawFile, rawCount, nextIndex: state.nextIndex },
      null,
      2,
    ),
  );
} catch (error) {
  runRecord.status = "failed";
  runRecord.completedAt = new Date().toISOString();
  runRecord.error = String(
    error instanceof Error ? error.message : error,
  ).slice(0, 500);
  const partialRawFile = await findRawFile(rawRoot);
  if (partialRawFile) {
    runRecord.rawFile = partialRawFile;
    runRecord.rawCount = (await readFile(partialRawFile, "utf8"))
      .split(/\r?\n/u)
      .filter(Boolean).length;
  }
  await saveState(statePath, state);
  await writeFile(
    resolve(runRoot, "manifest.json"),
    `${JSON.stringify(
      {
        version: 1,
        runId,
        status: "failed",
        platform: "xiaohongshu",
        keywordConfigurationVersion: configuration.version,
        keywordMatrixHash,
        keywordMatrixSize: keywords.length,
        keywords: selectedKeywords,
        rawFile: runRecord.rawFile ?? null,
        rawCount: runRecord.rawCount ?? 0,
        completedAt: runRecord.completedAt,
        error: runRecord.error,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  throw error;
}
