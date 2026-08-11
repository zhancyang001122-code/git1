import { randomUUID } from "node:crypto";

import { readLocalSupabaseEnvironment } from "./local-supabase-env.mjs";

const local = readLocalSupabaseEnvironment();
const appUrl = process.env.AUTH_TEST_APP_URL ?? "http://127.0.0.1:3101";
const mailpitUrl = local.MAILPIT_URL;
const email =
  process.env.AUTH_TEST_EMAIL ?? `auth-api-${randomUUID()}@example.test`;
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
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      origin: appUrl,
      ...(cookies.size > 0 && { cookie: cookieHeader() }),
      ...(init.body && { "content-type": "application/json" }),
      ...init.headers,
    },
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

function recipientMatches(message) {
  const recipients = Array.isArray(message.To) ? message.To : [message.To];
  return recipients.some((recipient) => recipient?.Address === email);
}

async function capturedOtp() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    const list = await listResponse.json();
    const captured = list.messages?.find(recipientMatches);
    if (captured?.ID) {
      const messageResponse = await fetch(
        `${mailpitUrl}/api/v1/message/${encodeURIComponent(captured.ID)}`,
      );
      const message = await messageResponse.json();
      const match = `${message.Text ?? ""}\n${message.HTML ?? ""}`.match(
        /(?<!\d)(\d{6})(?!\d)/,
      );
      if (match?.[1]) return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Mailpit did not capture a six-digit OTP");
}

await expectStatus(
  "application sends local email OTP",
  await appRequest("/api/auth/otp/send", {
    method: "POST",
    body: JSON.stringify({ email }),
  }),
  200,
);
const otp = await capturedOtp();
console.log("PASS Mailpit captures the custom six-digit OTP template");

const verified = await expectStatus(
  "application verifies OTP and establishes a session",
  await appRequest("/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ email, token: otp, next: "/me/preferences" }),
  }),
  200,
);
assert(verified.next === "/me/preferences", "safe return path changed");
assert(cookies.size > 0, "Auth verification did not set a session cookie");

const empty = await expectStatus(
  "authenticated user reads an empty preference state",
  await appRequest("/api/preferences"),
  200,
);
assert(
  empty.allowLongTermMemory === false,
  "expected preferences to be disabled",
);

const saved = await expectStatus(
  "authenticated user saves consented preferences",
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

const persisted = await expectStatus(
  "saved preferences survive a separate request",
  await appRequest("/api/preferences"),
  200,
);
assert(
  persisted.preferences?.maxHousingBudget === 4321,
  "saved preferences were not persisted",
);

const removed = await expectStatus(
  "user revokes memory and deletes the preference row",
  await appRequest("/api/preferences", {
    method: "PATCH",
    body: JSON.stringify({ allowLongTermMemory: false }),
  }),
  200,
);
assert(removed.preferences === null, "revoked preferences still returned data");

await expectStatus(
  "application signs out the current session",
  await appRequest("/api/auth/sign-out", { method: "POST" }),
  200,
);
await expectStatus(
  "signed-out session can no longer read preferences",
  await appRequest("/api/preferences"),
  401,
);

console.log(
  "Local Auth and Preferences API verification completed without logging email, OTP, cookies, or preference payloads.",
);
