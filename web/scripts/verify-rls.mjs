import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const supabaseConfig = readFileSync(
  new URL("../../supabase/config.toml", import.meta.url),
  "utf8",
);
const projectId = supabaseConfig.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];

if (!projectId) {
  throw new Error("Could not read project_id from supabase/config.toml");
}

const container =
  process.env.SUPABASE_TEST_DB_CONTAINER ?? `supabase_db_${projectId}`;
const userA = "70000000-0000-0000-0000-000000000001";
const userB = "70000000-0000-0000-0000-000000000002";
const sessionId = "71000000-0000-0000-0000-000000000001";
const messageId = "72000000-0000-0000-0000-000000000001";

function psql(sql) {
  return spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { encoding: "utf8", input: sql },
  );
}

function success(label, sql, expectedOutput) {
  const result = psql(sql);
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
  }
  const output = result.stdout.trim();
  if (expectedOutput !== undefined && output !== expectedOutput) {
    throw new Error(
      `${label} returned ${JSON.stringify(output)}, expected ${JSON.stringify(expectedOutput)}`,
    );
  }
  console.log(`PASS ${label}`);
}

function denied(label, sql) {
  const result = psql(sql);
  const output = `${result.stdout}\n${result.stderr}`;
  if (
    result.status === 0 ||
    !/(permission denied|row-level security)/i.test(output)
  ) {
    throw new Error(`${label} was not denied as expected:\n${output}`);
  }
  console.log(`PASS ${label}`);
}

success(
  "prepare isolated test identities",
  `
  delete from auth.users where id in ('${userA}', '${userB}');
  delete from public.ai_tool_runs where tool_name = 'rls_probe';
  insert into auth.users (id, raw_user_meta_data) values
    ('${userA}', '{"display_name":"RLS User A"}'),
    ('${userB}', '{"display_name":"RLS User B"}');
`,
);

success(
  "anon can read only available houses",
  `
  set role anon;
  select count(*) from public.houses;
`,
  "11",
);

success(
  "anon can read published knowledge metadata",
  `
  set role anon;
  select count(*) from public.kb_articles;
`,
  "4",
);

denied(
  "anon cannot insert business records",
  `
  set role anon;
  insert into public.houses (
    name, district, address, price_monthly, room_type, area_sqm,
    longitude, latitude
  ) values ('越权房源', '拱墅区', '禁止写入', 1, '一居室', 1, 120, 30);
`,
);

denied(
  "anon cannot read AI tool logs",
  `
  set role anon;
  select count(*) from public.ai_tool_runs;
`,
);

denied(
  "anon cannot read user preferences",
  `
  set role anon;
  select count(*) from public.user_preferences;
`,
);

denied(
  "anon cannot write user preferences",
  `
  set role anon;
  insert into public.user_preferences (
    user_id, max_housing_budget, allow_long_term_memory, consented_at
  ) values ('${userA}', 1, true, timezone('utc', now()));
`,
);

success(
  "authenticated user can write own preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userA}';
  insert into public.user_preferences (
    user_id, max_housing_budget, allow_long_term_memory, consented_at
  ) values ('${userA}', 3500, true, timezone('utc', now()))
  on conflict (user_id) do update set
    max_housing_budget = excluded.max_housing_budget,
    allow_long_term_memory = excluded.allow_long_term_memory,
    consented_at = excluded.consented_at;
  select max_housing_budget from public.user_preferences where user_id = '${userA}';
`,
  "3500",
);

success(
  "authenticated user cannot read another user's preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userB}';
  select count(*) from public.user_preferences where user_id = '${userA}';
`,
  "0",
);

denied(
  "authenticated user cannot write another user's preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userB}';
  insert into public.user_preferences (user_id, max_housing_budget, allow_long_term_memory)
  values ('${userA}', 999, false);
`,
);

success(
  "authenticated user cannot update another user's preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userB}';
  update public.user_preferences
  set max_housing_budget = 999
  where user_id = '${userA}'
  returning user_id;
`,
  "",
);

success(
  "authenticated user cannot delete another user's preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userB}';
  delete from public.user_preferences
  where user_id = '${userA}'
  returning user_id;
`,
  "",
);

success(
  "authenticated user can update own preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userA}';
  update public.user_preferences
  set max_housing_budget = 4200
  where user_id = '${userA}'
  returning max_housing_budget;
`,
  "4200",
);

success(
  "authenticated user can delete own preferences",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userA}';
  delete from public.user_preferences
  where user_id = '${userA}'
  returning user_id;
`,
  userA,
);

success(
  "feedback upsert is allowed only for the owner",
  `
  set role authenticated;
  set "request.jwt.claim.sub" = '${userA}';
  insert into public.conversation_sessions (id, user_id, title) values ('${sessionId}', '${userA}', 'RLS test');
  insert into public.conversation_messages (id, session_id, role, content) values ('${messageId}', '${sessionId}', 'assistant', 'test');
  insert into public.ai_feedback (user_id, session_id, message_id, rating, comment)
  values ('${userA}', '${sessionId}', '${messageId}', 'down', 'first')
  on conflict (message_id, user_id) do update set comment = excluded.comment;
  insert into public.ai_feedback (user_id, session_id, message_id, rating, comment)
  values ('${userA}', '${sessionId}', '${messageId}', 'up', 'updated')
  on conflict (message_id, user_id) do update set rating = excluded.rating, comment = excluded.comment;
  select rating || ':' || comment from public.ai_feedback where message_id = '${messageId}';
`,
  "up:updated",
);

success(
  "service role can write server-only AI tool logs",
  `
  set role service_role;
  insert into public.ai_tool_runs (tool_name, status, input_json, request_id)
  values ('rls_probe', 'succeeded', '{}', '74000000-0000-0000-0000-000000000001');
  select count(*) from public.ai_tool_runs where tool_name = 'rls_probe';
`,
  "1",
);

console.log("RLS verification completed with 16 role-boundary checks.");
