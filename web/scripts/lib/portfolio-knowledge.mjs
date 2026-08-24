import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluatePortfolioGeneration,
  evaluatePortfolioRetrieval,
  portfolioEvaluationSuiteSchema,
  portfolioKnowledgeSearchResultSchema,
  portfolioMaterialManifestSchema,
} from "../../src/features/evaluation/portfolio-first-party-suite.ts";

export const DEFAULT_PRODUCTION_URL = "https://xiaozhi.zaneyang.xyz";

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

export function optionalEnvironment(name) {
  return process.env[name]?.trim() || readEnvFile(name)?.trim();
}

export function requiredEnvironment(name) {
  const value = optionalEnvironment(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function productionUrl() {
  const value = new URL(
    process.env.PRODUCTION_URL?.trim() || DEFAULT_PRODUCTION_URL,
  );
  if (value.protocol !== "https:") {
    throw new Error("PRODUCTION_URL must use HTTPS");
  }
  return value;
}

export function supabaseConfiguration() {
  const url = new URL(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"));
  if (new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname)) {
    throw new Error("Portfolio verification requires remote Supabase");
  }
  return {
    url,
    secretKey: requiredEnvironment("SUPABASE_SECRET_KEY"),
  };
}

export function knowledgeDirectory(directoryName = "portfolio-first-party") {
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(directoryName)) {
    throw new Error("Knowledge set directory is invalid");
  }
  return resolve(process.cwd(), "../knowledge-base", directoryName);
}

export function loadKnowledgeSet(directoryName = "portfolio-first-party") {
  const directory = knowledgeDirectory(directoryName);
  const manifest = portfolioMaterialManifestSchema.parse(
    JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")),
  );
  const suite = portfolioEvaluationSuiteSchema.parse(
    JSON.parse(
      readFileSync(resolve(directory, "evaluation-cases.json"), "utf8"),
    ),
  );
  if (manifest.materialSet !== suite.materialSet) {
    throw new Error("Knowledge manifest and evaluation suite do not match");
  }
  return {
    directory,
    manifest,
    suite,
    materials: manifest.materials.map((material) => ({
      ...material,
      content: readFileSync(resolve(directory, material.file), "utf8").trim(),
    })),
  };
}

export function loadPortfolioKnowledge() {
  return loadKnowledgeSet("portfolio-first-party");
}

function restUrl(configuration, path) {
  return new URL(`/rest/v1/${path}`, configuration.url);
}

export async function supabaseRest(configuration, path, init = {}) {
  const response = await fetch(restUrl(configuration, path), {
    ...init,
    headers: {
      apikey: configuration.secretKey,
      authorization: `Bearer ${configuration.secretKey}`,
      ...(init.body && { "content-type": "application/json" }),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  return response;
}

export async function requireOkJson(response, label) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const code =
      body && typeof body === "object"
        ? body.error?.code || body.code || body.message
        : undefined;
    throw new Error(
      `${label} returned HTTP ${response.status}${code ? ` (${code})` : ""}`,
    );
  }
  return body;
}

export function adminHeaders(token) {
  if (token.length < 32) {
    throw new Error("ADMIN_VERIFICATION_TOKEN must contain 32 characters");
  }
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

export function proxyConfiguration() {
  const server = process.env.DEPLOYMENT_PROXY_SERVER?.trim();
  if (!server) return undefined;
  const value = new URL(server);
  if (!new Set(["http:", "https:", "socks5:"]).has(value.protocol)) {
    throw new Error("DEPLOYMENT_PROXY_SERVER must use HTTP, HTTPS or SOCKS5");
  }
  return { server };
}

export async function parseSse(response) {
  if (!response.ok) {
    throw new Error(`chat generation returned HTTP ${response.status}`);
  }
  const text = await response.text();
  const events = [];
  for (const frame of text.split(/\r?\n\r?\n/)) {
    if (!frame.trim()) continue;
    const eventLine = frame
      .split(/\r?\n/)
      .find((line) => line.startsWith("event:"));
    const dataLines = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"));
    if (!eventLine || dataLines.length === 0) continue;
    const type = eventLine.slice(6).trim();
    const data = JSON.parse(
      dataLines.map((line) => line.slice(5).trimStart()).join("\n"),
    );
    events.push({ type, data });
  }
  return events;
}

export function summarizeGeneration(events) {
  const citations = events
    .filter((event) => event.type === "citations")
    .flatMap((event) => event.data.citations ?? []);
  const toolSucceeded = events.some(
    (event) =>
      event.type === "tool_progress" &&
      event.data.source === "knowledge_base" &&
      event.data.status === "succeeded",
  );
  const error = events.find((event) => event.type === "error");
  const warningCodes = events
    .filter((event) => event.type === "warning")
    .map((event) => event.data.code);
  const debugRuns = events
    .filter((event) => event.type === "debug_tool_run")
    .map((event) => event.data.run);
  const cards = events
    .filter((event) => event.type === "result_cards")
    .flatMap((event) => event.data.cards ?? []);
  return {
    assistantText: events
      .filter((event) => event.type === "assistant_delta")
      .map((event) => event.data.delta ?? "")
      .join(""),
    toolSucceeded,
    citations,
    debugRuns,
    cards,
    errorCode: error?.data?.code ?? null,
    warningCodes,
  };
}

export {
  evaluatePortfolioGeneration,
  evaluatePortfolioRetrieval,
  portfolioKnowledgeSearchResultSchema,
};
