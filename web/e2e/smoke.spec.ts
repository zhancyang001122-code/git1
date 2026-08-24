import { expect, test } from "@playwright/test";

test("loads the Xiaozhi home page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "小智租房决策",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "从预算到签约核验，一次问完",
    }),
  ).toBeVisible();
});
