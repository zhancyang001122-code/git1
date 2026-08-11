import { createHmac, randomUUID } from "node:crypto";

import { readLocalSupabaseEnvironment } from "./local-supabase-env.mjs";

const localEnvironment = readLocalSupabaseEnvironment();
const apiRoot = localEnvironment.API_URL;
const restUrl = process.env.SUPABASE_TEST_REST_URL ?? localEnvironment.REST_URL;
const jwtSecret =
  process.env.SUPABASE_TEST_JWT_SECRET ?? localEnvironment.JWT_SECRET;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
const serviceToken = token("service_role");

async function json(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function adminRequest(path, init = {}) {
  return fetch(`${apiRoot}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceToken,
      Authorization: `Bearer ${serviceToken}`,
      ...(init.body && { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
}

async function createTestUser(label) {
  const response = await adminRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: `postgrest-${label}-${randomUUID()}@example.test`,
      email_confirm: true,
    }),
  });
  const body = await json(response);
  assert(
    response.ok && typeof body?.id === "string",
    `could not create ${label}`,
  );
  return body.id;
}

async function deleteTestUser(userId) {
  const response = await adminRequest(`/admin/users/${userId}`, {
    method: "DELETE",
  });
  assert(response.ok, "could not remove an isolated Auth test identity");
}

async function request(path, bearer, init = {}) {
  return fetch(`${restUrl}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${bearer}`,
      ...(init.body && { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
}

async function pass(label, action) {
  await action();
  console.log(`PASS ${label}`);
}

const userA = await createTestUser("user-a");
const userB = await createTestUser("user-b");
const userAToken = token("authenticated", userA);
const userBToken = token("authenticated", userB);

try {
  await pass("anon key reads only RLS-visible houses", async () => {
    const response = await request("/houses?select=id", anonKey);
    const body = await json(response);
    assert(
      response.status === 200,
      `expected 200, received ${response.status}`,
    );
    assert(
      Array.isArray(body) && body.length === 11,
      `expected 11 available houses, received ${body?.length ?? "invalid"}`,
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

  await pass("anon key cannot read user preferences", async () => {
    const response = await request("/user_preferences?select=user_id", anonKey);
    assert(
      response.status === 401 || response.status === 403,
      `expected denial, received ${response.status}`,
    );
  });

  await pass("anon key cannot write user preferences", async () => {
    const response = await request("/user_preferences", anonKey, {
      method: "POST",
      body: JSON.stringify({
        user_id: userA,
        max_housing_budget: 1,
        allow_long_term_memory: true,
        consented_at: new Date().toISOString(),
      }),
    });
    assert(
      response.status === 401 || response.status === 403,
      `expected denial, received ${response.status}`,
    );
  });

  await pass("authenticated user writes own preferences", async () => {
    const response = await request("/user_preferences", userAToken, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userA,
        max_housing_budget: 3500,
        allow_long_term_memory: true,
        consented_at: new Date().toISOString(),
      }),
    });
    const body = await json(response);
    assert(
      response.status === 201 &&
        Array.isArray(body) &&
        body[0]?.max_housing_budget === 3500,
      `own insert failed with ${response.status}`,
    );
  });

  await pass("authenticated user reads own preferences", async () => {
    const response = await request(
      `/user_preferences?select=user_id,max_housing_budget&user_id=eq.${userA}`,
      userAToken,
    );
    const body = await json(response);
    assert(
      response.status === 200 &&
        Array.isArray(body) &&
        body.length === 1 &&
        body[0].max_housing_budget === 3500,
      `own read failed with ${response.status}`,
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
        "cross-user rows leaked",
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
          allow_long_term_memory: true,
          consented_at: new Date().toISOString(),
        }),
      });
      assert(
        response.status === 401 || response.status === 403,
        `expected denial, received ${response.status}`,
      );
    },
  );

  await pass(
    "authenticated user cannot update another user's preferences",
    async () => {
      const response = await request(
        `/user_preferences?user_id=eq.${userA}`,
        userBToken,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ max_housing_budget: 999 }),
        },
      );
      const body = await json(response);
      assert(
        response.status === 200 && Array.isArray(body) && body.length === 0,
        "cross-user update affected a row",
      );
    },
  );

  await pass(
    "authenticated user cannot delete another user's preferences",
    async () => {
      const response = await request(
        `/user_preferences?user_id=eq.${userA}`,
        userBToken,
        { method: "DELETE", headers: { Prefer: "return=representation" } },
      );
      const body = await json(response);
      assert(
        response.status === 200 && Array.isArray(body) && body.length === 0,
        "cross-user delete affected a row",
      );
    },
  );

  await pass("authenticated user updates own preferences", async () => {
    const response = await request(
      `/user_preferences?user_id=eq.${userA}`,
      userAToken,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ max_housing_budget: 4200 }),
      },
    );
    const body = await json(response);
    assert(
      response.status === 200 && body?.[0]?.max_housing_budget === 4200,
      `own update failed with ${response.status}`,
    );
  });

  await pass("authenticated user deletes own preferences", async () => {
    const response = await request(
      `/user_preferences?user_id=eq.${userA}`,
      userAToken,
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
    const body = await json(response);
    assert(
      response.status === 200 && Array.isArray(body) && body.length === 1,
      `own delete failed with ${response.status}`,
    );
  });

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
      `service write failed with ${response.status}`,
    );
  });

  console.log(
    "PostgREST JWT verification completed with 14 HTTP boundary checks.",
  );
} finally {
  await Promise.all([deleteTestUser(userA), deleteTestUser(userB)]);
}
