import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseSse, summarizeGeneration } from "./lib/portfolio-knowledge.mjs";
import {
  assertFirstPartyRag,
  assertLiveAmap,
  assertRentalDecisionFlow,
} from "./lib/interview-preflight.mjs";
import {
  assertLocalLiveHealth,
  validateVerificationUrl,
} from "./lib/local-live-preflight.mjs";

const portText = process.env.LOCAL_PREFLIGHT_PORT?.trim() || "3117";
if (!/^\d{4,5}$/.test(portText)) {
  throw new Error("LOCAL_PREFLIGHT_PORT must be an integer from 1024 to 65535");
}
const port = Number(portText);
if (port < 1024 || port > 65_535) {
  throw new Error("LOCAL_PREFLIGHT_PORT must be an integer from 1024 to 65535");
}

async function healthAt(url, timeoutMs = 800) {
  try {
    const response = await fetch(new URL("/api/health", url), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

const explicitUrl = process.env.LOCAL_LIVE_URL?.trim();
const runningUrl = new URL(explicitUrl || "http://127.0.0.1:3001");
validateVerificationUrl(runningUrl);
if (
  runningUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "::1"].includes(runningUrl.hostname)
) {
  throw new Error("LOCAL_LIVE_URL 只允许本机 HTTP 回环地址");
}

let baseUrl = runningUrl;
let health = await healthAt(runningUrl);
let server = null;

if (!health && explicitUrl) {
  throw new Error(`LOCAL_LIVE_URL 当前不可访问：${runningUrl.href}`);
}

if (!health) {
  baseUrl = new URL(`http://127.0.0.1:${port}`);
  const occupied = await fetch(new URL("/api/health", baseUrl), {
    signal: AbortSignal.timeout(800),
  })
    .then(() => true)
    .catch(() => false);
  if (occupied) {
    throw new Error(
      `本机端口 ${port} 已被占用；请关闭对应程序，或临时设置 LOCAL_PREFLIGHT_PORT`,
    );
  }
  const nextBin = fileURLToPath(
    new URL("../node_modules/next/dist/bin/next", import.meta.url),
  );
  server = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    },
  );
}

async function waitForHealth() {
  for (let attempt = 1; attempt <= 120; attempt += 1) {
    if (server?.exitCode !== null) {
      throw new Error(`本机 Next.js 启动失败（退出码 ${server.exitCode}）`);
    }
    const currentHealth = await healthAt(baseUrl, 1_500);
    if (currentHealth) return currentHealth;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("本机 Next.js 在 60 秒内没有准备完成");
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

try {
  health ??= await waitForHealth();
  assertLocalLiveHealth(health);

  const amapResponse = await fetch(new URL("/api/maps/nearby", baseUrl), {
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

  const ragResponse = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "千问在小智里负责什么，它本身是事实来源吗？",
      debug: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  assertFirstPartyRag(summarizeGeneration(await parseSse(ragResponse)));

  const flagshipResponse = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message:
        "我预算3500元，想找武林广场附近的一居室。请查询2024年历史房源，再找附近的地铁和超市，并说明签约前需要核验哪些信息、是否需要办理网签备案。",
      debug: true,
      locationCity: "杭州",
      locationLabel: "杭州 · 武林广场",
      location: { longitude: 120.163102, latitude: 30.274085 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  assertRentalDecisionFlow(
    summarizeGeneration(await parseSse(flagshipResponse)),
  );

  const browserOutput = execFileSync(
    process.execPath,
    ["scripts/verify-production.mjs", "--mode=live"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DEPLOYMENT_URL: baseUrl.href },
    },
  ).trim();
  if (browserOutput) console.log(browserOutput);
  console.log(
    `PASS 本机 Live：高德、千问/RAG、房源和主要页面流程均已验证（${baseUrl.href}）。`,
  );
} finally {
  await stopServer();
}
