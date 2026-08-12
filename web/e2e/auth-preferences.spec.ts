import { expect, test } from "@playwright/test";

test("fixed demo code creates a real Supabase session and preserves RLS preferences", async ({
  page,
}) => {
  await page.goto("/me/preferences");
  await expect(page).toHaveURL(/\/login\?next=%2Fme%2Fpreferences/);
  await expect(page.getByText("固定演示码登录")).toBeVisible();
  await expect(page.getByText(/不会发送短信或邮件/)).toBeVisible();
  await expect(page.getByLabel("6 位演示码")).toHaveValue("666666");
  await page.getByRole("button", { name: "进入演示账号" }).click();
  await expect(page).toHaveURL(/\/me\/preferences$/);

  await page.getByLabel("住房月预算上限").fill("4200");
  await page.getByLabel("常用区域").fill("武林广场,滨江");
  await page
    .getByRole("button", { name: /同意并保存到云端|更新云端偏好/ })
    .click();
  await page.getByRole("button", { name: /确认保存|确认更新/ }).click();
  await expect(
    page.getByRole("status", { name: "云端偏好已保存" }),
  ).toBeVisible();

  await page.goto("/me");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "确认退出" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("button", { name: "进入演示账号" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await page.goto("/me/preferences");
  await expect(page.getByLabel("住房月预算上限")).toHaveValue("4200");
  await expect(page.getByLabel("常用区域")).toHaveValue("武林广场,滨江");

  await page.getByRole("button", { name: "关闭长期记忆并删除偏好" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(
    page.getByRole("status", { name: "长期偏好已从云端删除" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "长期记忆尚未启用" }),
  ).toBeVisible();
});
