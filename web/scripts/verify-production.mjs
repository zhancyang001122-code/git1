import { chromium, expect } from "@playwright/test";

const baseUrl =
  process.env.PRODUCTION_URL?.trim() || "https://xiaozhi-local-life.vercel.app";
const url = new URL(baseUrl);
if (url.protocol !== "https:") {
  throw new Error("PRODUCTION_URL must use HTTPS");
}
const expectedMode = process.env.EXPECTED_PRODUCTION_MODE?.trim() || "demo";
if (!new Set(["demo", "live"]).has(expectedMode)) {
  throw new Error("EXPECTED_PRODUCTION_MODE must be demo or live");
}

const browser = await chromium.launch();
const healthPage = await browser.newPage();
let health;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const response = await healthPage.goto(new URL("/api/health", url).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response?.ok()) {
      throw new Error(
        `production health check returned ${response?.status() ?? "no response"}`,
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
    `production mode disclosure is unexpected: ${JSON.stringify(health)}`,
  );
}

const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
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
  if (hasOverflow) throw new Error("production page has horizontal overflow");

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
    .poll(() => new URL(page.url()).searchParams.get("q"))
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
    const alertTexts = (
      await page.getByRole("alert").allTextContents({ timeoutMs: 5_000 })
    )
      .map((value) => value.trim())
      .filter(Boolean);
    if (alertTexts.length > 0) {
      throw new Error(`production UI alerts: ${alertTexts.join(" | ")}`);
    }
    const helpfulButton = page.getByRole("button", { name: "回答有帮助" });
    await expect(helpfulButton).toBeVisible();
    await helpfulButton.click();
    await expect(page.getByText("感谢反馈，已记录。")).toBeVisible();
  }

  if (browserErrors.length > 0) {
    throw new Error(`production browser errors: ${browserErrors.join(" | ")}`);
  }
  console.log(
    `PASS production ${expectedMode} health, mobile layout, housing, maps and feedback flow.`,
  );
} finally {
  await browser.close();
}
