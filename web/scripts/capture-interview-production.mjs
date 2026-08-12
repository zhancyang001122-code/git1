import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertLiveHealth,
  buildBackupIndex,
  isDisposablePlaywrightVideo,
  PRODUCTION_INTERVIEW_URL,
} from "./lib/interview-backup.mjs";

const outputDir = process.env.INTERVIEW_BACKUP_DIR?.trim();
if (!outputDir || !path.isAbsolute(outputDir)) {
  throw new Error("INTERVIEW_BACKUP_DIR must be an absolute path");
}

const productionUrl =
  process.env.PRODUCTION_URL?.trim() || PRODUCTION_INTERVIEW_URL;
if (productionUrl !== PRODUCTION_INTERVIEW_URL) {
  throw new Error(`Production recording must use ${PRODUCTION_INTERVIEW_URL}`);
}

const healthResponse = await fetch(new URL("/api/health", productionUrl), {
  signal: AbortSignal.timeout(30_000),
  headers: { accept: "application/json" },
});
if (!healthResponse.ok) {
  throw new Error(`Production health returned ${healthResponse.status}`);
}
assertLiveHealth(await healthResponse.json());

const videosDir = path.join(outputDir, "videos");
await mkdir(videosDir, { recursive: true });

const browser = await chromium.launch();
const scenes = [];

async function recordScene({ title, file, evidence, run }) {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    recordVideo: { dir: videosDir, size: { width: 430, height: 932 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const video = page.video();
  try {
    await run(page);
    if (errors.length > 0) {
      throw new Error(`${title} browser errors: ${errors.join(" | ")}`);
    }
    await page.waitForTimeout(1_500);
  } finally {
    await page.close();
    await context.close();
  }
  if (!video) throw new Error(`${title} did not start video recording`);
  await video.saveAs(path.join(videosDir, file));
  scenes.push({ title, file: `videos/${file}`, evidence });
}

try {
  await recordScene({
    title: "历史房源 + 高德",
    file: "01-housing-amap.webm",
    evidence: "同时验证 2024 历史房源来源标签与高德地图来源标签。",
    run: async (page) => {
      const query =
        "请帮我查杭州武林广场附近、3500元以下的一居室，并同时用高德查附近超市。房源和周边都要分别查询。";
      await page.goto(productionUrl, { waitUntil: "load", timeout: 45_000 });
      await page.getByRole("searchbox").fill(query);
      await page.getByRole("button", { name: "搜索" }).click();
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await expect(page.getByText("正在查询房源")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("正在查询周边地点")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("2024 历史房源数据").first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("高德地图").first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("接口演示数据")).toHaveCount(0);
    },
  });

  await recordScene({
    title: "作品集首方 RAG",
    file: "02-first-party-rag.webm",
    evidence: "验证千问自然问法、Knowledge Service 取证和版本化首方引用。",
    run: async (page) => {
      const query = "千问在小智里负责什么，它本身是事实来源吗？";
      const chatUrl = new URL("/xiaozhi/chat", productionUrl);
      chatUrl.searchParams.set("q", query);
      await page.goto(chatUrl.href, { waitUntil: "load", timeout: 45_000 });
      await page.getByRole("button", { name: "发送", exact: true }).click();
      const citations = page.getByRole("region", { name: "知识引用" });
      await expect(citations).toBeVisible({ timeout: 90_000 });
      await expect(citations).toContainText(
        "小智作品集：AI 事实来源与知识治理",
      );
      await expect(citations).toContainText("作品集首方说明");
      await expect(citations).toContainText("生效日期");
      await expect(page.getByText("模拟知识资料")).toHaveCount(0);
    },
  });

  await recordScene({
    title: "商品 + 授权偏好",
    file: "03-commerce-preference.webm",
    evidence: "验证演示商品来源、待确认偏好和取消后不写入的授权边界。",
    run: async (page) => {
      const query =
        "帮我找30元以内有库存的早餐，并记住我不吃辣。商品和偏好都要分别处理。";
      const chatUrl = new URL("/xiaozhi/chat", productionUrl);
      chatUrl.searchParams.set("q", query);
      await page.goto(chatUrl.href, { waitUntil: "load", timeout: 45_000 });
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await expect(page.getByText("正在查询商品")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("演示业务数据").first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("待你确认的长期偏好")).toBeVisible({
        timeout: 60_000,
      });
      await page
        .getByRole("region", { name: "查询结果与待确认操作" })
        .getByRole("button", { name: "取消", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({
          hasText: "已取消，本次没有保存长期偏好",
        }),
      ).toBeVisible();
    },
  });
} finally {
  await browser.close();
}

for (const entry of await readdir(videosDir)) {
  const candidate = path.join(videosDir, entry);
  if (isDisposablePlaywrightVideo(candidate, videosDir)) {
    await rm(candidate);
  }
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: process.cwd(),
  encoding: "utf8",
}).trim();
const recordedAt = new Date().toISOString();
await writeFile(
  path.join(outputDir, "index.html"),
  buildBackupIndex({ recordedAt, commit, productionUrl, scenes }),
  "utf8",
);
await writeFile(
  path.join(outputDir, "recording-evidence.json"),
  `${JSON.stringify(
    {
      recordedAt,
      commit,
      productionUrl,
      health: "live/configured",
      scenes,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify({ outputDir, recordedAt, commit, sceneCount: scenes.length }),
);
