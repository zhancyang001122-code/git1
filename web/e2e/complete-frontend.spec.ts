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
  await expect(page.getByText(/找到 7 条演示记录/)).toBeVisible();
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

test("chat executes the housing tool and renders typed cards", async ({
  page,
}) => {
  await page.goto("/xiaozhi/chat?q=找3500元以内允许养猫的房源&debug=true");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(
    page.getByText(
      "当前为确定性工具演示模式：没有调用真实千问，对话和审计不会写入云端",
    ),
  ).toBeVisible();
  await expect(page.getByText(/已从演示房源数据查询到/)).toBeVisible();
  await expect(page.getByRole("region", { name: "处理进度" })).toContainText(
    "正在查询房源",
  );
  await expect(page.getByRole("region", { name: "处理进度" })).toContainText(
    "已完成",
  );
  await expect(
    page.getByRole("link", { name: /查看房源 武林晴川一居室/ }),
  ).toBeVisible();
  await expect(page.getByText("工具：search_houses")).toBeVisible();
});

test("chat resolves exact demo stock without exposing internal tool names", async ({
  page,
}) => {
  await page.goto("/xiaozhi/chat?q=鲜牛奶现在还有库存吗");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(
    page.getByText(/鲜牛奶 950ml的演示可用库存为 30 件/),
  ).toBeVisible();
  await expect(page.getByText("演示库存 30")).toBeVisible();
  await expect(page.getByRole("region", { name: "处理进度" })).toContainText(
    "正在查询商品",
  );
  await expect(page.getByRole("region", { name: "处理进度" })).toContainText(
    "正在核对商品库存",
  );
  await page.getByText("调试摘要", { exact: true }).click();
  await expect(
    page.getByText("工具已执行；内部调试摘要未开启。"),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("search_products");
  await expect(page.locator("body")).not.toContainText("get_product_stock");
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
