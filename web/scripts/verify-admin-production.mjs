import { randomUUID } from "node:crypto";

import { chromium, expect } from "@playwright/test";

const baseUrl = new URL(
  process.env.PRODUCTION_URL?.trim() || "https://xiaozhi-local-life.vercel.app",
);
if (baseUrl.protocol !== "https:") {
  throw new Error("PRODUCTION_URL must use HTTPS");
}
const token = process.env.ADMIN_VERIFICATION_TOKEN?.trim();
if (!token || token.length < 32) {
  throw new Error(
    "ADMIN_VERIFICATION_TOKEN must contain at least 32 characters",
  );
}
const incidentMonitorRequestId =
  process.env.INCIDENT_MONITOR_REQUEST_ID?.trim() || randomUUID();
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    incidentMonitorRequestId,
  )
) {
  throw new Error("INCIDENT_MONITOR_REQUEST_ID must be a UUID");
}
const proxyServer = process.env.DEPLOYMENT_PROXY_SERVER?.trim();
if (proxyServer) {
  const proxyUrl = new URL(proxyServer);
  if (!new Set(["http:", "https:", "socks5:"]).has(proxyUrl.protocol)) {
    throw new Error("DEPLOYMENT_PROXY_SERVER must use HTTP, HTTPS or SOCKS5");
  }
}

const browser = await chromium.launch({
  ...(proxyServer && { proxy: { server: proxyServer } }),
});
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(new URL("/knowledge-admin", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/knowledge-admin\/login(?:\?|$)/);
  await expect(
    page.getByRole("heading", { level: 1, name: "知识运营登录" }),
  ).toBeVisible();
  await expect(page.getByLabel("管理口令")).toBeEnabled();

  const unauthorizedMonitor = await context.request.get(
    new URL("/api/internal/ai-ops-monitor", baseUrl).href,
  );
  expect(unauthorizedMonitor.status()).toBe(401);

  await page.getByLabel("管理口令").fill(token);
  await Promise.all([
    page.waitForURL(/\/knowledge-admin(?:\?|$)/),
    page.getByRole("button", { name: "验证并进入" }).click(),
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "知识运营演示" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI Ops 站内告警" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "跨实例工具审计" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "事故认领" })).toBeVisible();

  const monitorResponse = await context.request.get(
    new URL("/api/internal/ai-ops-monitor", baseUrl).href,
    { headers: { "x-request-id": incidentMonitorRequestId } },
  );
  expect(monitorResponse.status()).toBe(200);
  const monitor = await monitorResponse.json();
  for (const field of [
    "openedCount",
    "refreshedCount",
    "recoveredCount",
    "activeCount",
  ]) {
    if (!Number.isInteger(monitor[field]) || monitor[field] < 0) {
      throw new Error(`incident monitor returned invalid ${field}`);
    }
  }

  const cookies = await context.cookies(baseUrl.href);
  const session = cookies.find(
    (cookie) => cookie.name === "xiaozhi_knowledge_admin",
  );
  if (!session) throw new Error("admin session cookie was not set");
  if (!session.httpOnly || !session.secure || session.sameSite !== "Strict") {
    throw new Error("admin session cookie security attributes are invalid");
  }

  await Promise.all([
    page.waitForURL(/\/knowledge-admin\/login(?:\?|$)/),
    page.getByRole("button", { name: "退出管理登录" }).click(),
  ]);
  const afterLogout = await context.cookies(baseUrl.href);
  if (afterLogout.some((cookie) => cookie.name === "xiaozhi_knowledge_admin")) {
    throw new Error("admin session cookie remained after logout");
  }
  await page.goto(new URL("/knowledge-admin", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/knowledge-admin\/login(?:\?|$)/);

  console.log(
    `PASS Production admin redirect, login, AI Ops incident monitor (${incidentMonitorRequestId}), secure cookie, logout and re-protection flow.`,
  );
} finally {
  await browser.close();
}
