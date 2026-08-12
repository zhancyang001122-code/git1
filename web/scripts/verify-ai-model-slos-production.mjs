import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

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

class SseEventParser {
  buffer = "";

  push(chunk) {
    this.buffer += chunk;
    const events = [];
    while (true) {
      const separator = /\r?\n\r?\n/.exec(this.buffer);
      if (!separator || separator.index === undefined) return events;
      const frame = this.buffer.slice(0, separator.index);
      this.buffer = this.buffer.slice(separator.index + separator[0].length);
      let type = "";
      const data = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) type = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!type || data.length === 0) {
        throw new Error("production chat returned an invalid SSE frame");
      }
      events.push({ type, ...JSON.parse(data.join("\n")) });
    }
  }
}

const productionUrl = new URL(
  process.env.PRODUCTION_URL?.trim() || "https://xiaozhi.zaneyang.xyz",
);
if (productionUrl.protocol !== "https:") {
  throw new Error("PRODUCTION_URL must use HTTPS");
}
const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
if (new Set(["127.0.0.1", "localhost", "::1"]).has(supabaseUrl.hostname)) {
  throw new Error("Production SLO verification requires a remote Supabase URL");
}
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const proxyServer = process.env.DEPLOYMENT_PROXY_SERVER?.trim();
const browser = await chromium.launch({
  ...(proxyServer && { proxy: { server: proxyServer } }),
});
const context = await browser.newContext();

const chatResponse = await context.request.post(
  new URL("/api/chat", productionUrl).href,
  {
    data: {
      message: "请简短介绍杭州本地生活助手能做什么",
      debug: false,
    },
    timeout: 120_000,
  },
);
if (!chatResponse.ok()) {
  throw new Error(`production chat returned HTTP ${chatResponse.status()}`);
}
const parser = new SseEventParser();
const events = parser.push(await chatResponse.text());
const sessionId = events.find((event) => event.type === "session")?.sessionId;
const error = events.find((event) => event.type === "error");
if (error?.type === "error") {
  throw new Error(`production chat stream failed with ${error.code}`);
}
if (!events.some((event) => event.type === "assistant_delta")) {
  throw new Error("production chat emitted no visible assistant text");
}
if (!events.some((event) => event.type === "done")) {
  throw new Error("production chat stream did not complete");
}
if (!sessionId) throw new Error("production chat did not expose a session id");

async function rest(path, key) {
  return fetch(new URL(`/rest/v1/${path}`, supabaseUrl), {
    headers: { apikey: key, authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
}

const fields =
  "session_id,model_name,input_tokens,output_tokens,first_token_ms,estimated_cost_cny,pricing_effective_from";
const anonymous = await rest(
  `conversation_messages?select=${fields}&session_id=eq.${sessionId}`,
  publishableKey,
);
if (anonymous.ok) {
  const rows = await anonymous.json();
  if (Array.isArray(rows) && rows.length > 0) {
    throw new Error("anonymous client read private model SLO rows");
  }
} else if (![401, 403, 404].includes(anonymous.status)) {
  throw new Error(`anonymous SLO read returned HTTP ${anonymous.status}`);
}

let messages = [];
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const response = await rest(
    `conversation_messages?select=${fields}&session_id=eq.${sessionId}&role=eq.assistant&order=created_at.desc&limit=1`,
    secretKey,
  );
  if (!response.ok) {
    throw new Error(`service SLO read returned HTTP ${response.status}`);
  }
  messages = await response.json();
  if (messages.length > 0) break;
  await new Promise((resolvePromise) =>
    setTimeout(resolvePromise, attempt * 250),
  );
}
const message = messages[0];
if (!message) throw new Error("production assistant SLO row was not persisted");
if (!Number.isInteger(message.first_token_ms) || message.first_token_ms < 0) {
  throw new Error("production first_token_ms is invalid");
}
if (
  typeof message.estimated_cost_cny !== "number" ||
  message.estimated_cost_cny < 0
) {
  throw new Error("production estimated_cost_cny is invalid");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(message.pricing_effective_from ?? "")) {
  throw new Error("production pricing_effective_from is invalid");
}
if (
  !Number.isInteger(message.input_tokens) ||
  !Number.isInteger(message.output_tokens) ||
  !String(message.model_name ?? "").startsWith("qwen")
) {
  throw new Error("production model usage provenance is incomplete");
}

await browser.close();

console.log(
  JSON.stringify({
    sessionId,
    anonymousReadDenied: true,
    modelName: message.model_name,
    inputTokens: message.input_tokens,
    outputTokens: message.output_tokens,
    firstTokenMs: message.first_token_ms,
    estimatedCostCny: message.estimated_cost_cny,
    pricingEffectiveFrom: message.pricing_effective_from,
  }),
);
