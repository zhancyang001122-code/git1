import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
if (new Set(["127.0.0.1", "localhost", "::1"]).has(supabaseUrl.hostname)) {
  throw new Error(
    "Production incident verification requires a remote Supabase URL",
  );
}
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  readEnvFile("SUPABASE_SECRET_KEY")?.trim();
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required");

function restUrl(path) {
  return new URL(`/rest/v1/${path}`, supabaseUrl);
}

async function request(path, key, init = {}) {
  return fetch(restUrl(path), {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(init.body && { "content-type": "application/json" }),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
}

async function expectDenied(label, response) {
  if (response.ok) throw new Error(`${label} must be denied`);
  if (![401, 403, 404].includes(response.status)) {
    throw new Error(`${label} returned unexpected HTTP ${response.status}`);
  }
}

await expectDenied(
  "anonymous incident table read",
  await request("ai_ops_incidents?select=id&limit=1", publishableKey),
);
await expectDenied(
  "anonymous incident event table read",
  await request("ai_ops_incident_events?select=id&limit=1", publishableKey),
);
await expectDenied(
  "anonymous incident search",
  await request("rpc/search_ai_ops_incidents", publishableKey, {
    method: "POST",
    body: JSON.stringify({ p_limit: 1 }),
  }),
);
await expectDenied(
  "anonymous incident sync",
  await request("rpc/sync_ai_ops_incidents", publishableKey, {
    method: "POST",
    body: JSON.stringify({ p_window_hours: 24 }),
  }),
);

const syncResponse = await request("rpc/sync_ai_ops_incidents", secretKey, {
  method: "POST",
  body: JSON.stringify({ p_window_hours: 24 }),
});
if (!syncResponse.ok) {
  throw new Error(`service incident sync returned HTTP ${syncResponse.status}`);
}
const syncRows = await syncResponse.json();
const sync = Array.isArray(syncRows) ? syncRows[0] : syncRows;
for (const field of [
  "opened_count",
  "refreshed_count",
  "recovered_count",
  "active_count",
]) {
  if (!Number.isInteger(sync?.[field]) || sync[field] < 0) {
    throw new Error(`service incident sync returned invalid ${field}`);
  }
}
if (Number.isNaN(Date.parse(sync?.measured_at))) {
  throw new Error("service incident sync returned invalid measured_at");
}

const listResponse = await request("rpc/search_ai_ops_incidents", secretKey, {
  method: "POST",
  body: JSON.stringify({ p_limit: 20 }),
});
if (!listResponse.ok) {
  throw new Error(
    `service incident search returned HTTP ${listResponse.status}`,
  );
}
const incidents = await listResponse.json();
if (!Array.isArray(incidents) || incidents.length > 20) {
  throw new Error("service incident search returned an invalid bounded list");
}
const forbiddenKeys = new Set([
  "input_json",
  "output_summary",
  "prompt",
  "cookie",
  "authorization",
]);
for (const incident of incidents) {
  for (const key of Object.keys(incident)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      throw new Error(`incident search leaked forbidden field ${key}`);
    }
  }
}

console.log(
  JSON.stringify({
    anonymousTableDenied: true,
    anonymousEventTableDenied: true,
    anonymousSearchDenied: true,
    anonymousSyncDenied: true,
    openedCount: sync.opened_count,
    refreshedCount: sync.refreshed_count,
    recoveredCount: sync.recovered_count,
    activeCount: sync.active_count,
    incidentCount: incidents.length,
  }),
);
