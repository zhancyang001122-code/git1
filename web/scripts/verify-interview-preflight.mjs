import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { parseSse, summarizeGeneration } from "./lib/portfolio-knowledge.mjs";
import {
  assertBranchDeployment,
  assertFirstPartyRag,
  assertInvalidRequestBoundary,
  expectedBackupFiles,
} from "./lib/interview-preflight.mjs";
import {
  assertLiveHealth,
  PRODUCTION_INTERVIEW_URL,
} from "./lib/interview-backup.mjs";

const productionUrl = PRODUCTION_INTERVIEW_URL;
const backupDir =
  process.env.INTERVIEW_BACKUP_DIR?.trim() ||
  "C:\\Users\\Administrator\\Desktop\\xiaozhi-interview-backup-20260813";

function git(...args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

function gh(...args) {
  return execFileSync("gh", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

const status = git("status", "--porcelain");
if (status) throw new Error("Working tree must be clean before interview use");
const branch = git("branch", "--show-current");
if (branch !== "codex/housing-http-adapter") {
  throw new Error(`Unexpected interview branch: ${branch}`);
}
const localCommit = git("rev-parse", "HEAD");
const remoteCommit = gh(
  "api",
  "repos/zhancyang001122-code/git1/branches/codex/housing-http-adapter",
  "--jq",
  ".commit.sha",
);
const commitStatus = JSON.parse(
  gh("api", `repos/zhancyang001122-code/git1/commits/${localCommit}/status`),
);
assertBranchDeployment({
  localCommit,
  remoteCommit,
  statuses: commitStatus.statuses,
});

const healthResponse = await fetch(new URL("/api/health", productionUrl), {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(30_000),
});
if (!healthResponse.ok) {
  throw new Error(`Production health returned ${healthResponse.status}`);
}
assertLiveHealth(await healthResponse.json());

const invalidResponse = await fetch(new URL("/api/chat", productionUrl), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: "invalid" }),
  signal: AbortSignal.timeout(30_000),
});
const invalidBody = await invalidResponse.json();
assertInvalidRequestBoundary({
  status: invalidResponse.status,
  errorCode: invalidResponse.headers.get("x-error-code"),
  body: invalidBody,
});

const ragResponse = await fetch(new URL("/api/chat", productionUrl), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: "千问在小智里负责什么，它本身是事实来源吗？",
    debug: true,
  }),
  signal: AbortSignal.timeout(120_000),
});
const rag = summarizeGeneration(await parseSse(ragResponse));
assertFirstPartyRag(rag);

for (const file of expectedBackupFiles()) {
  await access(path.join(backupDir, ...file.split("/")));
}
const evidence = JSON.parse(
  await readFile(path.join(backupDir, "recording-evidence.json"), "utf8"),
);
if (
  evidence.productionUrl !== productionUrl ||
  evidence.health !== "live/configured" ||
  evidence.commit !== localCommit ||
  evidence.scenes?.length !== 3
) {
  throw new Error(
    "Offline recording evidence does not match the current commit",
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    productionUrl,
    commit: localCommit,
    deployment: "success",
    invalidRequest: "400/INVALID_CHAT_REQUEST",
    firstPartyRag: "grounded/cited",
    backupScenes: evidence.scenes.length,
    backupDir,
    note: "This preflight writes one test RAG conversation plus safe audit/rate-limit metadata. Run deploy:verify-production separately once before the interview; it writes two more test conversations and one feedback row.",
  }),
);
