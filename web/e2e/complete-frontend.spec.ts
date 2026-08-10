import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/discover",
  "/discover/50000000-0000-0000-0000-000000000001",
  "/xiaozhi",
  "/xiaozhi/chat?q=找房&source=home",
  "/xiaozhi/chat/demo-housing",
  "/xiaozhi/history",
  "/messages",
  "/me",
  "/me/favorites",
  "/me/history",
  "/me/orders",
  "/me/addresses",
  "/me/preferences",
  "/me/feedback",
  "/houses",
  "/houses/20000000-0000-0000-0000-000000000001",
  "/deals",
  "/deals/30000000-0000-0000-0000-000000000001",
  "/market",
  "/market/stores/10000000-0000-0000-0000-000000000001",
  "/market/products/40000000-0000-0000-0000-000000000001",
  "/cart",
  "/nearby",
  "/knowledge-admin",
  "/knowledge-admin/candidate-refund-001",
] as const;

for (const route of routes) {
  test(`${route} renders inside the mobile product canvas`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    const width = await page
      .locator("body > div")
      .first()
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(430);
    expect(
      await page
        .locator("body")
        .evaluate((body) => body.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("housing filters and local favorite work", async ({ page }) => {
  await page.goto("/houses");
  await page.getByRole("button", { name: "允许宠物" }).click();
  await expect(page.getByText(/找到 7 条历史记录/)).toBeVisible();
  await page.getByRole("button", { name: "收藏房源" }).first().click();
  await expect(
    page.getByRole("button", { name: "取消收藏房源" }),
  ).toBeVisible();
});

test("cart state survives client-side navigation", async ({ page }) => {
  await page.goto("/market");
  await page.getByRole("button", { name: "加入购物车" }).first().click();
  await page.getByRole("link", { name: /购物车 1 件/ }).click();
  await expect(page.getByRole("button", { name: "模拟结算" })).toBeVisible();
  await page.getByRole("button", { name: "模拟结算" }).click();
  await expect(
    page.getByText(/这是结算流程演示，不会创建真实订单/),
  ).toBeVisible();
});

test("scripted chat exposes progress and a sourced result", async ({
  page,
}) => {
  await page.goto("/xiaozhi/chat?q=找3500元以内允许养猫的房源&debug=true");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("正在查询演示房源")).toBeVisible();
  await expect(page.getByText(/本地脚本演示已完成/)).toBeVisible();
  await expect(page.getByText("2024 历史房源数据")).toBeVisible();
});

test("feedback and knowledge review never claim remote writes", async ({
  page,
}) => {
  await page.goto("/me/feedback");
  await page.getByLabel("纠正建议").fill("退款规则需要补充预约限制。");
  await page.getByRole("button", { name: "提交演示反馈" }).click();
  await expect(
    page.getByText(/反馈仅生成待审核候选，没有写入数据库/),
  ).toBeVisible();
  await page.goto("/knowledge-admin/candidate-refund-001");
  await page.getByRole("button", { name: "批准草稿" }).click();
  await expect(
    page.getByText(/本地状态已更新为“已批准”，尚未发布/),
  ).toBeVisible();
});
