import { expect, test } from "@playwright/test";

test("loads the Xiaozhi home page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "小智本地生活",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "小智本地生活 AI 服务助手",
    }),
  ).toBeVisible();
});
