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
  "knowledge_candidates",
  "knowledge_reviews",
  "ai_eval_cases",
  "ai_eval_runs",
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
