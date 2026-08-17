import { chromium, expect } from "@playwright/test";

const baseUrl =
  process.env.DEPLOYMENT_URL?.trim() ||
  process.env.PRODUCTION_URL?.trim() ||
  "https://xiaozhi.zaneyang.xyz";
const url = new URL(baseUrl);
if (url.protocol !== "https:") {
  throw new Error("DEPLOYMENT_URL must use HTTPS");
}
const modeArgument = process.argv.find((value) => value.startsWith("--mode="));
const expectedMode =
  modeArgument?.slice("--mode=".length).trim() ||
  process.env.EXPECTED_DEPLOYMENT_MODE?.trim() ||
  process.env.EXPECTED_PRODUCTION_MODE?.trim() ||
  "demo";
if (!new Set(["demo", "live"]).has(expectedMode)) {
  throw new Error("EXPECTED_DEPLOYMENT_MODE must be demo or live");
}
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const protectedDeploymentHeaders = protectionBypass
  ? {
      "x-vercel-protection-bypass": protectionBypass,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;
const proxyServer = process.env.DEPLOYMENT_PROXY_SERVER?.trim();
if (proxyServer) {
  const proxyUrl = new URL(proxyServer);
  if (!new Set(["http:", "https:", "socks5:"]).has(proxyUrl.protocol)) {
    throw new Error("DEPLOYMENT_PROXY_SERVER must use HTTP, HTTPS or SOCKS5");
  }
}
const browserChannel =
  process.env.DEPLOYMENT_BROWSER_CHANNEL?.trim() ||
  (process.platform === "win32" ? "msedge" : undefined);
if (browserChannel && !new Set(["chrome", "msedge"]).has(browserChannel)) {
  throw new Error("DEPLOYMENT_BROWSER_CHANNEL must be chrome or msedge");
}
const bypassSystemProxyValue =
  process.env.DEPLOYMENT_BYPASS_SYSTEM_PROXY?.trim() ||
  (process.platform === "win32" ? "true" : "false");
if (!new Set(["true", "false"]).has(bypassSystemProxyValue)) {
  throw new Error("DEPLOYMENT_BYPASS_SYSTEM_PROXY must be true or false");
}
const bypassSystemProxy = bypassSystemProxyValue === "true";

const browser = await chromium.launch({
  ...(proxyServer && { proxy: { server: proxyServer } }),
  ...(!proxyServer && browserChannel && { channel: browserChannel }),
  ...(!proxyServer && bypassSystemProxy && { args: ["--no-proxy-server"] }),
});
const healthPage = await browser.newPage({
  extraHTTPHeaders: protectedDeploymentHeaders,
});
let health;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const response = await healthPage.goto(new URL("/api/health", url).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response?.ok()) {
      throw new Error(
        `deployment health check returned ${response?.status() ?? "no response"}`,
      );
    }
    health = JSON.parse((await healthPage.locator("body").textContent()) ?? "");
    break;
  } catch (error) {
    if (attempt === 3) throw error;
    await healthPage.waitForTimeout(attempt * 500);
  }
}
await healthPage.close();
const expectedServiceStatus =
  expectedMode === "live" ? "configured" : "disabled";
if (
  health?.app !== "xiaozhi" ||
  health.mode !== expectedMode ||
  Object.values(health.services ?? {}).some(
    (status) => status !== expectedServiceStatus,
  )
) {
  throw new Error(
    `deployment mode disclosure is unexpected: ${JSON.stringify(health)}`,
  );
}

async function businessAlertTexts(targetPage) {
  return (
    await targetPage
      .locator('[role="alert"]:not(#__next-route-announcer__)')
      .allTextContents()
  )
    .map((value) => value.trim())
    .filter(Boolean);
}

const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  extraHTTPHeaders: protectedDeploymentHeaders,
});
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

try {
  await page.goto(url.toString(), { waitUntil: "load", timeout: 45_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "小智本地生活" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "小智本地生活 AI 服务助手",
    }),
  ).toBeVisible();
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (hasOverflow) throw new Error("deployment page has horizontal overflow");

  const searchbox = page.getByRole("searchbox");
  const query =
    expectedMode === "live"
      ? "请帮我查杭州武林广场附近、3500元以下的一居室，并同时用高德查附近超市。房源和周边都要分别查询。"
      : "找武林广场附近3500元以内的一居室";
  await searchbox.fill(query);
  await expect(searchbox).toHaveValue(query);
  const searchButton = page.getByRole("button", { name: "搜索" });
  await expect(searchButton).toBeEnabled({ timeout: 10_000 });
  await searchButton.click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"), {
      timeout: 20_000,
    })
    .toBe(query);
  await page.getByRole("button", { name: "发送" }).click();
  if (expectedMode === "demo") {
    await expect(
      page.getByRole("link", { name: /查看房源 武林晴川一居室/ }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("status").filter({ hasText: "当前为本地确定性演示" }),
    ).toBeVisible();
  } else {
    await expect(page.getByText("正在查询房源")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("正在查询周边地点")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("2024 历史房源数据").first()).toBeVisible();
    await expect(page.getByText("高德地图").first()).toBeVisible();
    await expect(page.getByText("接口演示数据")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "发送", exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    const alertTexts = await businessAlertTexts(page);
    if (alertTexts.length > 0) {
      throw new Error(`deployment UI alerts: ${alertTexts.join(" | ")}`);
    }
    const helpfulButton = page.getByRole("button", { name: "回答有帮助" });
    await expect(helpfulButton).toBeVisible();
    await helpfulButton.click();
    await expect(page.getByText("感谢反馈，已记录。")).toBeVisible();
  }

  if (expectedMode === "live") {
    const commercePage = await browser.newPage({
      viewport: { width: 430, height: 932 },
      extraHTTPHeaders: protectedDeploymentHeaders,
    });
    const commerceErrors = [];
    commercePage.on("pageerror", (error) => commerceErrors.push(error.message));
    commercePage.on("console", (message) => {
      if (message.type() === "error") commerceErrors.push(message.text());
    });
    try {
      const commerceQuery =
        "帮我找30元以内有库存的早餐，并记住我不吃辣。商品和偏好都要分别处理。";
      const commerceUrl = new URL("/xiaozhi/chat", url);
      commerceUrl.searchParams.set("q", commerceQuery);
      await commercePage.goto(commerceUrl.href, {
        waitUntil: "load",
        timeout: 45_000,
      });
      await expect(
        commercePage.getByRole("textbox", { name: "输入消息" }),
      ).toHaveValue(commerceQuery);
      await commercePage
        .getByRole("button", { name: "发送", exact: true })
        .click();
      await expect(commercePage.getByText("正在查询商品")).toBeVisible({
        timeout: 60_000,
      });
      await expect(
        commercePage
          .getByText(/鲜牛奶 950ml|无菌鸡蛋 10 枚|即食燕麦 500g/)
          .first(),
      ).toBeVisible({ timeout: 60_000 });
      await expect(commercePage.getByText("待你确认的长期偏好")).toBeVisible({
        timeout: 60_000,
      });
      await expect(
        commercePage.getByText("不吃辣", { exact: true }),
      ).toBeVisible();
      await commercePage
        .getByRole("region", { name: "查询结果与待确认操作" })
        .getByRole("button", { name: "取消", exact: true })
        .click();
      await expect(
        commercePage.getByRole("status").filter({
          hasText: "已取消，本次没有保存长期偏好",
        }),
      ).toBeVisible();
      const commerceAlerts = await businessAlertTexts(commercePage);
      if (commerceAlerts.length > 0) {
        throw new Error(
          `deployment commerce UI alerts: ${commerceAlerts.join(" | ")}`,
        );
      }
      if (commerceErrors.length > 0) {
        throw new Error(
          `deployment commerce browser errors: ${commerceErrors.join(" | ")}`,
        );
      }
    } finally {
      await commercePage.close();
    }
  }

  if (browserErrors.length > 0) {
    throw new Error(`deployment browser errors: ${browserErrors.join(" | ")}`);
  }
  console.log(
    `PASS deployment ${expectedMode} health, mobile layout, housing, maps, commerce, preference proposal and feedback flow.`,
  );
} finally {
  await browser.close();
}
