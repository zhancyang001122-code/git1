import { createHmac, randomUUID } from "node:crypto";

const apiUrl = process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:55433";
const jwtSecret =
  process.env.SUPABASE_TEST_JWT_SECRET ??
  "xiaozhi-task4-local-jwt-secret-32-bytes-minimum";
const userA = "70000000-0000-0000-0000-000000000001";
const userB = "70000000-0000-0000-0000-000000000002";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(role, sub) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    role,
    ...(sub && { sub }),
  });
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const anonKey = token("anon");
const userAToken = token("authenticated", userA);
const userBToken = token("authenticated", userB);
const serviceToken = token("service_role");

async function request(path, bearer, init = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${bearer}`,
      ...(init.body && { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
}

async function json(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function pass(label, action) {
  await action();
  console.log(`PASS ${label}`);
}

await pass("anon key reads only RLS-visible houses", async () => {
  const response = await request("/houses?select=id", anonKey);
  const body = await json(response);
  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(
    Array.isArray(body) && body.length === 11,
    `expected 11 available houses, received ${JSON.stringify(body)}`,
  );
});

await pass("anon key cannot insert business records", async () => {
  const response = await request("/houses", anonKey, {
    method: "POST",
    body: JSON.stringify({
      name: "越权房源",
      district: "拱墅区",
      address: "禁止写入",
      price_monthly: 1,
      room_type: "一居室",
      area_sqm: 1,
      longitude: 120,
      latitude: 30,
    }),
  });
  assert(
    response.status === 401 || response.status === 403,
    `expected denial, received ${response.status}`,
  );
});

await pass("anon key cannot read server-only AI logs", async () => {
  const response = await request("/ai_tool_runs?select=id", anonKey);
  assert(
    response.status === 401 || response.status === 403,
    `expected denial, received ${response.status}`,
  );
});

await pass("authenticated user reads own preferences", async () => {
  const response = await request(
    `/user_preferences?select=user_id,max_housing_budget&user_id=eq.${userA}`,
    userAToken,
  );
  const body = await json(response);
  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(
    Array.isArray(body) &&
      body.length === 1 &&
      body[0].max_housing_budget === 3500,
    `unexpected body ${JSON.stringify(body)}`,
  );
});

await pass(
  "authenticated user cannot read another user's preferences",
  async () => {
    const response = await request(
      `/user_preferences?select=user_id&user_id=eq.${userA}`,
      userBToken,
    );
    const body = await json(response);
    assert(
      response.status === 200 && Array.isArray(body) && body.length === 0,
      `cross-user rows leaked: ${JSON.stringify(body)}`,
    );
  },
);

await pass(
  "authenticated user cannot write another user's preferences",
  async () => {
    const response = await request("/user_preferences", userBToken, {
      method: "POST",
      body: JSON.stringify({
        user_id: userA,
        max_housing_budget: 999,
        allow_long_term_memory: false,
      }),
    });
    assert(
      response.status === 401 || response.status === 403,
      `expected denial, received ${response.status}`,
    );
  },
);

await pass("service key can write server-only AI logs", async () => {
  const response = await request("/ai_tool_runs", serviceToken, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tool_name: "http_rls_probe",
      status: "succeeded",
      input_json: {},
      request_id: randomUUID(),
    }),
  });
  const body = await json(response);
  assert(
    response.status === 201 && Array.isArray(body) && body.length === 1,
    `service write failed: ${response.status} ${JSON.stringify(body)}`,
  );
});

console.log(
  "PostgREST JWT verification completed with 7 HTTP boundary checks.",
);
