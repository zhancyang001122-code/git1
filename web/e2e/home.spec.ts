import { expect, test } from "@playwright/test";

test("home page renders its complete presentation structure", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "小智租房决策" }),
  ).toBeVisible();
  await expect(page.getByRole("search")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "从预算到签约核验，一次问完" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "开始主演示" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看交付证据" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "更多生活服务" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "更多演示内容" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
});

test("case study exposes verified evidence and the unverified user outcome", async ({
  page,
}) => {
  await page.goto("/case-study");
  await expect(
    page.getByRole("heading", { name: "小智租房决策助手" }),
  ).toBeVisible();
  await expect(page.getByText("60,202", { exact: true })).toBeVisible();
  await expect(page.getByText("10 / 10", { exact: true })).toBeVisible();
  await expect(page.getByText("2024-11", { exact: true })).toBeVisible();
  await expect(page.getByText(/尚未完成真实用户效率验证/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "立即运行主演示" }),
  ).toBeVisible();
});

test("search carries the question into the validated chat route", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("帮我找房");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"))
    .toBe("帮我找房");
  await expect(page.getByRole("heading", { name: "小智对话" })).toBeVisible();
});

test("service entries navigate to completed product routes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "租房" }).click();
  await expect(page).toHaveURL(/\/houses$/);
  await expect(page.getByRole("heading", { name: "房源列表" })).toBeVisible();
});
