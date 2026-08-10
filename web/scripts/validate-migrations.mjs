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
