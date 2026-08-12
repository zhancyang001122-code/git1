const appUrl = new URL(
  process.env.AUTH_TEST_APP_URL ?? "http://127.0.0.1:3101",
);
const demoCode = "666666";
const cookies = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function updateCookies(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  for (const header of values) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
}

function cookieHeader() {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function appRequest(path, init = {}) {
  const response = await fetch(new URL(path, appUrl), {
    ...init,
    headers: {
      accept: "application/json",
      origin: appUrl.origin,
      ...(cookies.size > 0 && { cookie: cookieHeader() }),
      ...(init.body && { "content-type": "application/json" }),
      ...init.headers,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  updateCookies(response);
  return response;
}

async function body(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function expectStatus(label, response, status) {
  const payload = await body(response);
  if (response.status !== status) {
    throw new Error(
      `${label} failed with ${response.status} (${payload?.error?.code ?? "UNKNOWN"})`,
    );
  }
  console.log(`PASS ${label}`);
  return payload;
}

async function signIn(label) {
  const payload = await expectStatus(
    label,
    await appRequest("/api/auth/demo-login", {
      method: "POST",
      body: JSON.stringify({ code: demoCode, next: "/me/preferences" }),
    }),
    200,
  );
  assert(payload.next === "/me/preferences", "safe return path changed");
  assert(cookies.size > 0, "demo login did not set a session cookie");
}

await signIn("fixed demo code establishes a Supabase session");

await expectStatus(
  "wrong demo code is rejected",
  await appRequest("/api/auth/demo-login", {
    method: "POST",
    body: JSON.stringify({ code: "123456" }),
  }),
  400,
);

const saved = await expectStatus(
  "authenticated demo user saves consented preferences",
  await appRequest("/api/preferences", {
    method: "PATCH",
    body: JSON.stringify({
      allowLongTermMemory: true,
      preferences: {
        maxHousingBudget: 4321,
        preferredAreas: ["武林广场"],
      },
    }),
  }),
  200,
);
assert(
  saved.allowLongTermMemory === true &&
    saved.preferences?.maxHousingBudget === 4321,
  "saved preference response did not match",
);

await expectStatus(
  "application signs out the demo session",
  await appRequest("/api/auth/sign-out", { method: "POST" }),
  200,
);
await expectStatus(
  "signed-out session cannot read preferences",
  await appRequest("/api/preferences"),
  401,
);

await signIn("fixed demo code signs in again without email delivery");
const persisted = await expectStatus(
  "RLS preference survives a separate authenticated session",
  await appRequest("/api/preferences"),
  200,
);
assert(
  persisted.preferences?.maxHousingBudget === 4321,
  "saved preferences were not persisted",
);

const removed = await expectStatus(
  "demo user clears shared preferences before handoff",
  await appRequest("/api/preferences", {
    method: "PATCH",
    body: JSON.stringify({ allowLongTermMemory: false }),
  }),
  200,
);
assert(removed.preferences === null, "cleared preferences still returned data");

await expectStatus(
  "application signs out the cleaned demo session",
  await appRequest("/api/auth/sign-out", { method: "POST" }),
  200,
);

console.log(
  "Demo Auth and RLS preference verification completed without logging account credentials, cookies or preference payloads.",
);
