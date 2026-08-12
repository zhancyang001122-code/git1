import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const migrationDirectory = resolve(
  process.cwd(),
  "..",
  "supabase",
  "migrations",
);
const entries = (await readdir(migrationDirectory))
  .filter((name) => /^\d{12,14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(entries.length > 0, "No timestamped Supabase migrations found");
assert(
  new Set(entries.map((name) => name.split("_", 1)[0])).size === entries.length,
  "Migration timestamps must be unique",
);

const migrations = await Promise.all(
  entries.map(async (name) => ({
    name,
    sql: await readFile(join(migrationDirectory, name), "utf8"),
  })),
);

const historicalHousingMigration = migrations.find((migration) =>
  migration.name.endsWith("_historical_housing.sql"),
);
assert(historicalHousingMigration, "Historical housing migration is missing");
const housingImportStatusMigration = migrations.find((migration) =>
  migration.name.endsWith("_housing_import_observability.sql"),
);
assert(
  housingImportStatusMigration,
  "Housing import observability migration is missing",
);
const aiOpsDashboardMigration = migrations.find((migration) =>
  migration.name.endsWith("_ai_ops_dashboard.sql"),
);
assert(aiOpsDashboardMigration, "AI Ops dashboard migration is missing");
const ragOpsTrendMigration = migrations.find((migration) =>
  migration.name.endsWith("_rag_ops_trend.sql"),
);
assert(ragOpsTrendMigration, "RAG Ops trend migration is missing");
const knowledgeIndexQueueMigration = migrations.find((migration) =>
  migration.name.endsWith("_knowledge_index_queue.sql"),
);
assert(
  knowledgeIndexQueueMigration,
  "Knowledge index queue migration is missing",
);
const aiModelCostMigration = migrations.find((migration) =>
  migration.name.endsWith("_ai_model_cost.sql"),
);
assert(aiModelCostMigration, "AI model cost migration is missing");
const aiOpsAlertsMigration = migrations.find((migration) =>
  migration.name.endsWith("_ai_ops_alerts.sql"),
);
assert(aiOpsAlertsMigration, "AI Ops alerts migration is missing");
const distributedRateLimitsMigration = migrations.find((migration) =>
  migration.name.endsWith("_distributed_rate_limits.sql"),
);
assert(
  distributedRateLimitsMigration,
  "distributed rate limits migration is missing",
);
const apiRouteLogsMigration = migrations.find((migration) =>
  migration.name.endsWith("_api_route_logs.sql"),
);
assert(apiRouteLogsMigration, "API route logs migration is missing");
const aiOpsIncidentsMigration = migrations.find((migration) =>
  migration.name.endsWith("_ai_ops_incidents.sql"),
);
assert(aiOpsIncidentsMigration, "AI Ops incidents migration is missing");
const aiModelSlosMigration = migrations.find((migration) =>
  migration.name.endsWith("_ai_model_slos.sql"),
);
assert(aiModelSlosMigration, "AI model SLO migration is missing");
const knowledgeMaterialProvenanceMigration = migrations.find((migration) =>
  migration.name.endsWith("_knowledge_material_provenance.sql"),
);
assert(
  knowledgeMaterialProvenanceMigration,
  "Knowledge material provenance migration is missing",
);

for (const migration of migrations) {
  const normalized = migration.sql.trim().toLowerCase();
  assert(
    normalized.startsWith("begin;"),
    `${migration.name} must start with begin;`,
  );
  assert(
    normalized.endsWith("commit;"),
    `${migration.name} must end with commit;`,
  );
  assert(
    !/\b(todo|tbd|fixme)\b/i.test(migration.sql),
    `${migration.name} contains an unfinished placeholder`,
  );
}

const allSql = migrations.map(({ sql }) => sql).join("\n");
const historicalHousingSql = historicalHousingMigration.sql;
const housingImportStatusSql = housingImportStatusMigration.sql;
const aiOpsDashboardSql = aiOpsDashboardMigration.sql;
const ragOpsTrendSql = ragOpsTrendMigration.sql;
const knowledgeIndexQueueSql = knowledgeIndexQueueMigration.sql;
const aiModelCostSql = aiModelCostMigration.sql;
const aiOpsAlertsSql = aiOpsAlertsMigration.sql;
const distributedRateLimitsSql = distributedRateLimitsMigration.sql;
const apiRouteLogsSql = apiRouteLogsMigration.sql;
const aiOpsIncidentsSql = aiOpsIncidentsMigration.sql;
const aiModelSlosSql = aiModelSlosMigration.sql;
const knowledgeMaterialProvenanceSql = knowledgeMaterialProvenanceMigration.sql;
const sqlStatements = allSql
  .split(";")
  .map((statement) => statement.trim().toLowerCase());
const createdTables = [
  ...allSql.matchAll(/create table public\.([a-z0-9_]+)/gi),
].map((match) => match[1]);
const rlsTables = new Set(
  [
    ...allSql.matchAll(
      /alter table public\.([a-z0-9_]+) enable row level security/gi,
    ),
  ].map((match) => match[1]),
);
const missingRls = createdTables.filter((table) => !rlsTables.has(table));
assert(missingRls.length === 0, `RLS is missing for: ${missingRls.join(", ")}`);

for (const requirement of [
  {
    pattern:
      /add column if not exists material_kind text not null default 'external_authorized'/i,
    message: "Knowledge material provenance column is missing",
  },
  {
    pattern: /'demo', 'portfolio_first_party', 'external_authorized'/i,
    message: "Knowledge material provenance values are incomplete",
  },
  {
    pattern: /drop function public\.hybrid_search_kb_v2\(/i,
    message: "Hybrid knowledge search must be rebuilt for its new return type",
  },
  {
    pattern: /material_kind text[\s\S]+e\.material_kind/i,
    message: "Hybrid search must return knowledge material provenance",
  },
]) {
  assert(
    requirement.pattern.test(knowledgeMaterialProvenanceSql),
    requirement.message,
  );
}

for (const requirement of [
  {
    pattern: /create table public\.knowledge_index_jobs\b/i,
    message: "Knowledge index queue table is missing",
  },
  {
    pattern: /unique\s*\(version_id\)/i,
    message: "Knowledge index jobs must be idempotent per version",
  },
  {
    pattern: /for update skip locked/i,
    message: "Knowledge index claim must use SKIP LOCKED",
  },
  {
    pattern: /lease_expires_at/i,
    message: "Knowledge index jobs must use leases",
  },
  {
    pattern: /create or replace function public\.claim_knowledge_index_job/i,
    message: "Knowledge index claim RPC is missing",
  },
  {
    pattern: /create or replace function public\.fail_knowledge_index_job/i,
    message: "Knowledge index retry RPC is missing",
  },
  {
    pattern:
      /create or replace function public\.publish_knowledge_candidate[\s\S]+perform public\.enqueue_knowledge_index_job/i,
    message: "Knowledge publication and queue insertion must be atomic",
  },
  {
    pattern:
      /revoke all on function public\.claim_knowledge_index_job\(uuid, integer\)[\s\S]+from public, anon, authenticated/i,
    message: "Knowledge index claim must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.claim_knowledge_index_job\(uuid, integer\)[\s\S]+to service_role/i,
    message: "Knowledge index claim must be service-role only",
  },
]) {
  assert(requirement.pattern.test(knowledgeIndexQueueSql), requirement.message);
}

for (const requirement of [
  {
    pattern: /create table public\.api_route_logs/i,
    message: "API route log table is missing",
  },
  {
    pattern: /create or replace function public\.search_api_route_logs/i,
    message: "bounded API route log search RPC is missing",
  },
  {
    pattern: /alter table public\.api_route_logs enable row level security/i,
    message: "API route log table must enable RLS",
  },
  {
    pattern:
      /revoke all on table public\.api_route_logs[\s\S]+from public, anon, authenticated/i,
    message: "API route logs must revoke client table access",
  },
  {
    pattern:
      /grant execute on function public\.search_api_route_logs\(integer, text, integer\)[\s\S]+to service_role/i,
    message: "API route log search must be service-role only",
  },
]) {
  assert(requirement.pattern.test(apiRouteLogsSql), requirement.message);
}

for (const requirement of [
  {
    pattern: /create table public\.ai_ops_incidents/i,
    message: "AI Ops incident table is missing",
  },
  {
    pattern: /create table public\.ai_ops_incident_events/i,
    message: "AI Ops incident event table is missing",
  },
  {
    pattern: /create or replace function public\.sync_ai_ops_incidents/i,
    message: "AI Ops incident sync RPC is missing",
  },
  {
    pattern: /pg_advisory_xact_lock/i,
    message: "AI Ops incident sync must serialize concurrent monitors",
  },
  {
    pattern:
      /unique index ai_ops_incidents_one_active_signal_idx[\s\S]+where status in \('open', 'acknowledged'\)/i,
    message: "AI Ops incidents must allow only one active incident per signal",
  },
  {
    pattern:
      /revoke all on function public\.transition_ai_ops_incident\(uuid, text, text, text\)[\s\S]+from public, anon, authenticated/i,
    message: "AI Ops incident transitions must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.search_ai_ops_incidents\(integer\)[\s\S]+to service_role/i,
    message: "AI Ops incident search must be service-role only",
  },
]) {
  assert(requirement.pattern.test(aiOpsIncidentsSql), requirement.message);
}

for (const requirement of [
  {
    pattern: /add column first_token_ms integer/i,
    message: "first-token latency column is missing",
  },
  {
    pattern: /add column estimated_cost_cny numeric/i,
    message: "estimated request cost column is missing",
  },
  {
    pattern: /add column pricing_effective_from date/i,
    message: "cost pricing provenance column is missing",
  },
  {
    pattern: /percentile_disc\(0\.95\)/i,
    message: "first-token P95 computation is missing",
  },
  {
    pattern: /'first_token_p95'::text/i,
    message: "first-token alert is missing",
  },
  {
    pattern: /'session_cost'::text/i,
    message: "session-cost alert is missing",
  },
  {
    pattern: /requests = priced_requests/i,
    message: "session-cost alert must exclude partially priced sessions",
  },
]) {
  assert(requirement.pattern.test(aiModelSlosSql), requirement.message);
}

for (const requirement of [
  {
    pattern:
      /create or replace function public\.get_ai_model_usage\s*\(\s*p_window_hours integer default 168\s*\)/i,
    message: "AI model usage RPC is missing",
  },
  {
    pattern:
      /group by[\s\S]+model_name[\s\S]+input_tokens[\s\S]+output_tokens/i,
    message: "AI model usage must preserve per-request pricing buckets",
  },
  {
    pattern:
      /revoke all on function public\.get_ai_model_usage\(integer\)[\s\S]+from public, anon, authenticated/i,
    message: "AI model usage must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.get_ai_model_usage\(integer\)[\s\S]+to service_role/i,
    message: "AI model usage must be service-role only",
  },
]) {
  assert(requirement.pattern.test(aiModelCostSql), requirement.message);
}

for (const requirement of [
  {
    pattern: /create or replace function public\.search_ai_tool_run_logs/i,
    message: "central tool-run log search RPC is missing",
  },
  {
    pattern: /create or replace function public\.get_ai_ops_alerts/i,
    message: "AI Ops alert evaluation RPC is missing",
  },
  {
    pattern:
      /tool_failure_rate[\s\S]+rag_no_result_rate[\s\S]+knowledge_index_backlog[\s\S]+rag_eval_failure_rate/i,
    message: "AI Ops alert set is incomplete",
  },
  {
    pattern:
      /revoke all on function public\.search_ai_tool_run_logs\(integer, text, text\)[\s\S]+from public, anon, authenticated/i,
    message: "tool-run log search must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.get_ai_ops_alerts\(integer\)[\s\S]+to service_role/i,
    message: "AI Ops alerts must be service-role only",
  },
]) {
  assert(requirement.pattern.test(aiOpsAlertsSql), requirement.message);
}

for (const requirement of [
  {
    pattern: /create table public\.api_rate_limit_windows/i,
    message: "shared rate-limit table is missing",
  },
  {
    pattern: /create or replace function public\.check_api_rate_limit/i,
    message: "atomic shared rate-limit RPC is missing",
  },
  {
    pattern:
      /on conflict \(scope, key_hash, window_start\)[\s\S]+request_count\s*=\s*[^;]+request_count\s*\+\s*1/i,
    message: "shared rate-limit counter must increment atomically",
  },
  {
    pattern:
      /alter table public\.api_rate_limit_windows enable row level security/i,
    message: "shared rate-limit table must enable RLS",
  },
  {
    pattern:
      /revoke all on function public\.check_api_rate_limit\(text, text, integer, integer\)[\s\S]+from public, anon, authenticated/i,
    message: "shared rate-limit RPC must revoke client execution",
  },
]) {
  assert(
    requirement.pattern.test(distributedRateLimitsSql),
    requirement.message,
  );
}

for (const table of ["housing_dataset_releases", "historical_houses"]) {
  assert(
    new RegExp(`create table public\\.${table}\\b`, "i").test(
      historicalHousingSql,
    ),
    `${table} must be created by the historical housing migration`,
  );
  assert(
    new RegExp(
      `alter table public\\.${table} enable row level security`,
      "i",
    ).test(historicalHousingSql),
    `${table} must enable RLS in its migration`,
  );
  assert(
    !new RegExp(`create policy [^;]+ on public\\.${table}\\b`, "i").test(
      historicalHousingSql,
    ),
    `${table} must remain server-only without client policies`,
  );
}

for (const requirement of [
  {
    pattern: /create extension if not exists postgis with schema extensions/i,
    message: "PostGIS must be enabled in the extensions schema",
  },
  {
    pattern:
      /create index historical_houses_location_idx[\s\S]+using gist\s*\(location\)/i,
    message: "Historical housing must have a GiST location index",
  },
  {
    pattern: /create index historical_houses_filter_idx[\s\S]+price_monthly/i,
    message: "Historical housing must have a business filter index",
  },
  {
    pattern:
      /create or replace function public\.search_historical_houses\s*\(/i,
    message: "Historical housing search RPC is missing",
  },
  {
    pattern:
      /create or replace function public\.activate_housing_dataset\s*\(/i,
    message: "Historical housing activation RPC is missing",
  },
  {
    pattern: /set search_path = ''/i,
    message: "Historical housing functions must fix search_path",
  },
  {
    pattern: /greatest\s*\(1,\s*least\(p_limit,\s*24\)\)/i,
    message: "Historical housing RPC must bound p_limit to 1..24",
  },
  {
    pattern: /p_radius_m\s+between\s+100\s+and\s+5000/i,
    message: "Historical housing RPC must bound radius to 100..5000m",
  },
  {
    pattern: /r\.status\s*=\s*'active'/i,
    message: "Historical housing RPC must only query the active release",
  },
]) {
  assert(requirement.pattern.test(historicalHousingSql), requirement.message);
}

for (const role of ["public", "anon", "authenticated"]) {
  assert(
    new RegExp(
      `revoke all on table[\\s\\S]+public\\.housing_dataset_releases[\\s\\S]+public\\.historical_houses[\\s\\S]+from ${role}\\b`,
      "i",
    ).test(historicalHousingSql),
    `Historical housing tables must revoke client access from ${role}`,
  );
}

assert(
  /grant execute on function public\.search_historical_houses\([^;]+\) to service_role/i.test(
    historicalHousingSql,
  ),
  "Historical housing search RPC must be service-role only",
);
assert(
  /grant execute on function public\.activate_housing_dataset\(uuid\)\s+to service_role/i.test(
    historicalHousingSql,
  ),
  "Historical housing activation RPC must be service-role only",
);

for (const requirement of [
  {
    pattern:
      /create or replace function public\.get_housing_import_status\s*\(p_release_id uuid\)/i,
    message: "Housing import status RPC is missing",
  },
  {
    pattern: /set search_path = ''/i,
    message: "Housing import status RPC must fix search_path",
  },
  {
    pattern: /pg_database_size\s*\(current_database\(\)\)/i,
    message: "Housing import status must report database size",
  },
  {
    pattern: /pg_total_relation_size\s*\('public\.historical_houses'/i,
    message: "Housing import status must report relation size",
  },
  {
    pattern:
      /revoke execute on function public\.get_housing_import_status\(uuid\)[\s\S]+from public, anon, authenticated/i,
    message: "Housing import status RPC must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.get_housing_import_status\(uuid\)[\s\S]+to service_role/i,
    message: "Housing import status RPC must be service-role only",
  },
]) {
  assert(requirement.pattern.test(housingImportStatusSql), requirement.message);
}

for (const requirement of [
  {
    pattern:
      /create or replace function public\.get_ai_ops_dashboard\s*\(p_window_hours integer default 168\)/i,
    message: "AI Ops dashboard RPC is missing",
  },
  {
    pattern: /greatest\s*\(1,\s*least\(p_window_hours,\s*720\)\)/i,
    message: "AI Ops dashboard must bound its time window",
  },
  {
    pattern: /set search_path = ''/i,
    message: "AI Ops dashboard RPC must fix search_path",
  },
  {
    pattern:
      /revoke all on function public\.get_ai_ops_dashboard\(integer\)[\s\S]+from public, anon, authenticated/i,
    message: "AI Ops dashboard must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.get_ai_ops_dashboard\(integer\)[\s\S]+to service_role/i,
    message: "AI Ops dashboard must be service-role only",
  },
]) {
  assert(requirement.pattern.test(aiOpsDashboardSql), requirement.message);
}

for (const requirement of [
  {
    pattern:
      /create or replace function public\.get_ai_ops_dashboard\s*\(p_window_hours integer default 168\)/i,
    message: "AI Ops dashboard correction RPC is missing",
  },
  {
    pattern: /runs\.status in \('succeeded', 'failed', 'timed_out'\)/i,
    message: "AI Ops dashboard must count terminal tool runs only",
  },
  {
    pattern:
      /create or replace function public\.get_rag_ops_trend\s*\(p_days integer default 7\)/i,
    message: "RAG Ops trend RPC is missing",
  },
  {
    pattern: /greatest\s*\(1,\s*least\(p_days,\s*30\)\)/i,
    message: "RAG Ops trend must bound its day window",
  },
  {
    pattern: /set search_path = ''/i,
    message: "RAG Ops trend RPC must fix search_path",
  },
  {
    pattern:
      /revoke all on function public\.get_rag_ops_trend\(integer\)[\s\S]+from public, anon, authenticated/i,
    message: "RAG Ops trend must revoke client execution",
  },
  {
    pattern:
      /grant execute on function public\.get_rag_ops_trend\(integer\)[\s\S]+to service_role/i,
    message: "RAG Ops trend must be service-role only",
  },
]) {
  assert(requirement.pattern.test(ragOpsTrendSql), requirement.message);
}

const publicReadTables = [
  "stores",
  "houses",
  "deals",
  "products",
  "product_inventory",
  "community_posts",
  "kb_categories",
  "kb_articles",
  "kb_article_versions",
];
for (const table of publicReadTables) {
  assert(
    new RegExp(
      `create policy [a-z0-9_]+ on public\\.${table} for select to (?:anon, authenticated|authenticated, anon)`,
      "i",
    ).test(allSql),
    `${table} must have an explicit public read-only policy`,
  );
  assert(
    !new RegExp(
      `create policy [a-z0-9_]+ on public\\.${table} for (?:insert|update|delete|all)`,
      "i",
    ).test(allSql),
    `${table} must not expose public writes`,
  );
  assert(
    sqlStatements.some(
      (statement) =>
        statement.startsWith("grant select on table") &&
        statement.includes(`public.${table}`) &&
        statement.includes("to anon, authenticated"),
    ),
    `${table} must have an explicit anon/authenticated SELECT grant`,
  );
}

assert(
  !/create policy [a-z0-9_]+ on public\.[a-z0-9_]+ for (?:insert|update|delete|all) to [^;\n]*\banon\b/i.test(
    allSql,
  ),
  "Anonymous write policy detected",
);
assert(
  !sqlStatements.some(
    (statement) =>
      /^grant (?:insert|update|delete|all)/.test(statement) &&
      /\bto\s+anon\b/.test(statement),
  ),
  "Anonymous table write grant detected",
);

const serverOnlyTables = [
  "kb_chunks",
  "ai_tool_runs",
  "knowledge_index_jobs",
  "knowledge_candidates",
  "knowledge_reviews",
  "ai_eval_cases",
  "ai_eval_runs",
  "api_route_logs",
  "ai_ops_incidents",
  "ai_ops_incident_events",
];
for (const table of serverOnlyTables) {
  assert(
    !new RegExp(`create policy [a-z0-9_]+ on public\\.${table} `, "i").test(
      allSql,
    ),
    `${table} must remain service-role only`,
  );
}

for (const policy of [
  "preferences_own_all",
  "sessions_own_read",
  "sessions_own_insert",
  "sessions_own_update",
  "messages_own_read",
  "messages_own_insert",
  "feedback_own_insert",
  "feedback_own_update",
  "feedback_own_read",
]) {
  assert(
    new RegExp(`create policy ${policy}\\b`, "i").test(allSql),
    `Required owner policy ${policy} is missing`,
  );
}

assert(
  /add column available_stock integer\s+generated always as \(stock - reserved\) stored/i.test(
    allSql,
  ),
  "Inventory must expose a database-computed available_stock value",
);

const requiredSeedTables = [
  "stores",
  "houses",
  "deals",
  "products",
  "product_inventory",
  "community_posts",
];
for (const table of requiredSeedTables) {
  assert(
    new RegExp(`insert into public\\.${table}\\b`, "i").test(allSql),
    `Demo seed is missing ${table}`,
  );
}

console.log(
  `Validated ${migrations.length} migrations, ${createdTables.length} tables, and RLS coverage for every table.`,
);
