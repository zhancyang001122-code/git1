import { execFileSync } from "node:child_process";

import { parseSse, summarizeGeneration } from "./lib/portfolio-knowledge.mjs";
import {
  assertBranchDeployment,
  assertFirstPartyRag,
  assertInvalidRequestBoundary,
  assertLiveAmap,
  assertLiveHealth,
  PRODUCTION_INTERVIEW_URL,
} from "./lib/interview-preflight.mjs";

const productionUrl = PRODUCTION_INTERVIEW_URL;

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

const amapResponse = await fetch(new URL("/api/maps/nearby", productionUrl), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    action: "resolve",
    kind: "manual",
    city: "杭州",
    name: "武林广场",
  }),
  signal: AbortSignal.timeout(30_000),
});
assertLiveAmap({
  status: amapResponse.status,
  body: await amapResponse.json(),
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

const liveFlowOutput = execFileSync(
  process.execPath,
  ["scripts/verify-production.mjs", "--mode=live"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  },
).trim();
if (liveFlowOutput) console.log(liveFlowOutput);

console.log(
  JSON.stringify({
    status: "PASS",
    productionUrl,
    commit: localCommit,
    deployment: "success",
    invalidRequest: "400/INVALID_CHAT_REQUEST",
    amap: "live/geocoding",
    firstPartyRag: "grounded/cited",
    liveFlow: "PASS",
    note: "This preflight performs real production checks and writes three test conversations plus one feedback row. It does not require or generate recording evidence.",
  }),
);
