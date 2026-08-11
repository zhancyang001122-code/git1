import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { readLocalSupabaseEnvironment } from "./local-supabase-env.mjs";

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

function required(name, fallback) {
  const value = process.env[name]?.trim() || fallback?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertLocalUrl(value, label) {
  const hostname = new URL(value).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    throw new Error(`${label} must point to a local service`);
  }
}

const verifyRemote = process.env.VERIFY_REMOTE_FEEDBACK === "true";
const local = readLocalSupabaseEnvironment();
const supabaseUrl = verifyRemote
  ? required(
      "NEXT_PUBLIC_SUPABASE_URL",
      readEnvFile("NEXT_PUBLIC_SUPABASE_URL"),
    )
  : required("NEXT_PUBLIC_SUPABASE_URL", local.API_URL);
const secretKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  (verifyRemote ? readEnvFile("SUPABASE_SECRET_KEY") : undefined) ||
  (verifyRemote ? readEnvFile("SUPABASE_SERVICE_ROLE_KEY") : undefined) ||
  local.SECRET_KEY ||
  required("SUPABASE_SERVICE_ROLE_KEY", local.SERVICE_ROLE_KEY);
const cookieSecret = required(
  "ANONYMOUS_COOKIE_SECRET",
  readEnvFile("ANONYMOUS_COOKIE_SECRET"),
);
const configuredBaseUrl = process.env.LIVE_FEEDBACK_BASE_URL?.trim();
const verificationPort = 32_000 + (process.pid % 10_000);
const baseUrl =
  configuredBaseUrl || `http://127.0.0.1:${verificationPort.toString()}`;

if (!verifyRemote) assertLocalUrl(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
assertLocalUrl(baseUrl, "LIVE_FEEDBACK_BASE_URL");
if (verifyRemote && !configuredBaseUrl) {
  throw new Error("LIVE_FEEDBACK_BASE_URL is required for remote verification");
}
if (Buffer.byteLength(cookieSecret, "utf8") < 32) {
  throw new Error("ANONYMOUS_COOKIE_SECRET must contain at least 32 bytes");
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymousId = randomBytes(32).toString("base64url");
const signature = createHmac("sha256", cookieSecret)
  .update(anonymousId)
  .digest("base64url");
const sessionId = randomUUID();
const messageId = randomUUID();
let candidateId;

function ensure(result, label) {
  if (result.error) throw new Error(`${label} failed: ${result.error.code}`);
  return result.data;
}

async function startVerificationServer() {
  if (configuredBaseUrl) return null;
  const nextCli = resolve(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const output = [];
  const child = spawn(
    process.execPath,
    [
      nextCli,
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(verificationPort),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_DEMO_MODE: "false",
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SECRET_KEY: secretKey,
        SUPABASE_SERVICE_ROLE_KEY: "",
        ANONYMOUS_COOKIE_SECRET: cookieSecret,
        DASHSCOPE_API_KEY: "",
        AMAP_WEB_SERVICE_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const capture = (chunk) => {
    output.push(String(chunk));
    if (output.join("").length > 8_000) output.shift();
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`local Live server exited early:\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return child;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  child.kill();
  throw new Error(
    `local Live server did not become ready:\n${output.join("")}`,
  );
}

const server = await startVerificationServer();
try {
  ensure(
    await admin.from("conversation_sessions").insert({
      id: sessionId,
      anonymous_id: anonymousId,
      title: "Live feedback verification",
    }),
    "create session",
  );
  ensure(
    await admin.from("conversation_messages").insert({
      id: messageId,
      session_id: sessionId,
      role: "user",
      content: `验证问题 ${sessionId}：押金扣款需要哪些证据？`,
    }),
    "create message",
  );

  const response = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `xiaozhi_anonymous_session=${anonymousId}.${signature}`,
    },
    body: JSON.stringify({
      sessionId,
      messageId,
      rating: "down",
      reason: "missing_source",
      comment: verifyRemote
        ? "远程 Live 反馈链路验证"
        : "本地 Live 反馈链路验证",
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `feedback API failed with ${response.status}: ${payload.error?.code}`,
    );
  }
  if (payload.isDemo !== false || !payload.feedbackId || !payload.candidateId) {
    throw new Error("feedback API did not return a persisted Live result");
  }
  candidateId = payload.candidateId;

  const feedback = ensure(
    await admin
      .from("ai_feedback")
      .select("id,user_id,session_id,message_id,rating,reason")
      .eq("id", payload.feedbackId)
      .single(),
    "read feedback",
  );
  if (
    feedback.user_id !== null ||
    feedback.session_id !== sessionId ||
    feedback.message_id !== messageId ||
    feedback.rating !== "down" ||
    feedback.reason !== "missing_source"
  ) {
    throw new Error("persisted feedback does not match the request");
  }

  const candidate = ensure(
    await admin
      .from("knowledge_candidates")
      .select("id,source_type,source_session_id,source_message_id,status")
      .eq("id", candidateId)
      .single(),
    "read candidate",
  );
  if (
    candidate.source_type !== "user_feedback" ||
    candidate.source_session_id !== sessionId ||
    candidate.source_message_id !== messageId ||
    candidate.status !== "pending"
  ) {
    throw new Error(
      "persisted knowledge candidate does not match the feedback",
    );
  }

  console.log(
    `PASS ${verifyRemote ? "Remote" : "Local"} Live feedback persisted feedback and a reviewable knowledge candidate.`,
  );
} finally {
  if (candidateId) {
    ensure(
      await admin.from("knowledge_candidates").delete().eq("id", candidateId),
      "clean candidate",
    );
  }
  ensure(
    await admin.from("conversation_sessions").delete().eq("id", sessionId),
    "clean session",
  );
  server?.kill();
}
