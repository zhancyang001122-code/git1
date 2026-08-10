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

test("search stays local and reports its unavailable boundary", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.getByRole("searchbox").fill("帮我找房");
  await page.getByRole("button", { name: "搜索" }).click();

  await expect(page.getByRole("status")).toContainText(
    "小智对话将在下一阶段接通",
  );
  expect(apiRequests).toEqual([]);
});

test("service entries explain the current delivery boundary", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "租房" }).click();

  await expect(page.getByRole("status")).toContainText(
    "租房功能将在下一阶段开放",
  );
  await expect(page).toHaveURL("/");
});
