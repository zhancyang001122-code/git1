import { expect, test } from "@playwright/test";

test("the interview demo covers search, grounded tools and feedback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("找武林广场附近3500元以内的一居室");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page).toHaveURL(/\/xiaozhi\/chat\?q=/);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(
    page.getByRole("link", { name: /查看房源 武林晴川一居室/ }),
  ).toBeVisible();

  await page.goto(
    `/xiaozhi/chat?q=${encodeURIComponent("未使用的团购券可以退款吗")}`,
  );
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("region", { name: "知识引用" })).toContainText(
    "团购券退款规则",
  );
  await page.getByRole("button", { name: "回答需改进" }).click();
  await expect(page.getByText(/已生成服务器内存中的待审核候选/)).toBeVisible();
});

test("the interview multi-tool scenario exposes progress and provenance", async ({
  page,
}) => {
  await page.goto(
    `/xiaozhi/chat?q=${encodeURIComponent("找武林广场附近3500以内且附近有超市的一居室，并告诉我退租押金规则")}&debug=true`,
  );
  await page.getByRole("button", { name: "发送" }).click();

  const progress = page.getByRole("region", { name: "处理进度" });
  await expect(progress).toContainText("正在查询房源");
  await expect(progress).toContainText("正在查询周边地点");
  await expect(progress).toContainText("正在检索知识依据");
  await expect(page.getByRole("region", { name: "知识引用" })).toBeVisible();
  await expect(page.getByText("工具：search_houses")).toBeVisible();
  await expect(page.getByText("工具：search_nearby_places")).toBeVisible();
  await expect(page.getByText("工具：search_knowledge")).toBeVisible();
});
