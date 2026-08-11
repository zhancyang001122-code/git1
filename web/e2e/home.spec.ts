import { expect, test } from "@playwright/test";

test("home page renders its complete presentation structure", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "小智本地生活 AI 服务助手" }),
  ).toBeVisible();
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.getByRole("heading", { name: "常用服务" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "附近精选" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
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
