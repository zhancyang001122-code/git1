function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseKey) {
  throw new Error("SUPABASE_SECRET_KEY is required");
}

const requestIds = process.argv.slice(2);
if (
  requestIds.length === 0 ||
  requestIds.some(
    (value) =>
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  )
) {
  throw new Error("Provide one or more UUID request IDs");
}

const response = await fetch(
  new URL("/rest/v1/rpc/search_api_route_logs", supabaseUrl),
  {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_limit: 50,
      p_method: null,
      p_status_class: null,
    }),
    signal: AbortSignal.timeout(15_000),
  },
);
if (!response.ok) {
  throw new Error(`Route log query returned HTTP ${response.status}`);
}

const wanted = new Set(requestIds);
const rows = (await response.json())
  .filter((row) => wanted.has(row.request_id))
  .sort((left, right) => left.request_id.localeCompare(right.request_id))
  .map((row) => ({
    routeKey: row.route_key,
    method: row.method,
    statusCode: row.status_code,
    durationMs: row.duration_ms,
    requestId: row.request_id,
    errorCode: row.error_code,
  }));

console.log(JSON.stringify({ matched: rows.length, rows }));
if (rows.length !== wanted.size) {
  throw new Error(`Expected ${wanted.size} route logs, found ${rows.length}`);
}
