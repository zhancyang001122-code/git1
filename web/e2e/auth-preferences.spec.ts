import { expect, test, type APIRequestContext } from "@playwright/test";

const mailpitUrl = process.env.SUPABASE_AUTH_TEST_MAILPIT_URL;

interface MailpitAddress {
  Address?: string;
}

interface MailpitSummary {
  ID?: string;
  To?: MailpitAddress | MailpitAddress[];
}

async function capturedOtp(request: APIRequestContext, email: string) {
  expect(mailpitUrl, "local Mailpit URL").toBeTruthy();
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpitUrl}/api/v1/messages`);
        const payload = (await response.json()) as {
          messages?: MailpitSummary[];
        };
        const message = payload.messages?.find((entry) => {
          const recipients = Array.isArray(entry.To) ? entry.To : [entry.To];
          return recipients.some((recipient) => recipient?.Address === email);
        });
        messageId = message?.ID;
        return messageId;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();

  const response = await request.get(
    `${mailpitUrl}/api/v1/message/${encodeURIComponent(messageId!)}`,
  );
  const message = (await response.json()) as { Text?: string; HTML?: string };
  const token = `${message.Text ?? ""}\n${message.HTML ?? ""}`.match(
    /(?<!\d)(\d{6})(?!\d)/,
  )?.[1];
  expect(token, "captured six-digit OTP").toMatch(/^\d{6}$/);
  return token!;
}

test("real local OTP session protects, persists, proposes, revokes and signs out preferences", async ({
  page,
  request,
}) => {
  test.skip(!mailpitUrl, "Local Supabase Mailpit is not configured");
  const email = `playwright-auth-${Date.now()}@example.test`;

  await page.goto("/me/preferences");
  await expect(page).toHaveURL(/\/login\?next=%2Fme%2Fpreferences/);
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  const otp = await capturedOtp(request, email);
  await page.getByLabel("6 位验证码").fill(otp);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await expect(page).toHaveURL(/\/me\/preferences$/);

  await page.getByLabel("住房月预算上限").fill("4200");
  await page.getByLabel("常用区域").fill("武林广场,滨江");
  await page.getByRole("button", { name: "同意并保存到云端" }).click();
  await page.getByRole("button", { name: "确认保存" }).click();
  await expect(
    page.getByRole("status", { name: "云端偏好已保存" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("住房月预算上限")).toHaveValue("4200");
  await expect(page.getByLabel("常用区域")).toHaveValue("武林广场,滨江");

  await page.goto(
    `/xiaozhi/chat?q=${encodeURIComponent("以后都记住我的租房预算是5000")}`,
  );
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("¥5,000 / 月")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("已取消，本次没有保存长期偏好")).toBeVisible();
  await page.goto("/me/preferences");
  await expect(page.getByLabel("住房月预算上限")).toHaveValue("4200");

  await page.goto(
    `/xiaozhi/chat?q=${encodeURIComponent("以后都记住我的租房预算是5000")}`,
  );
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认保存" }).click();
  await expect(
    page.getByRole("status", { name: "偏好已保存到云端" }),
  ).toBeVisible();
  await page.goto("/me/preferences");
  await expect(page.getByLabel("住房月预算上限")).toHaveValue("5000");

  await page.getByRole("button", { name: "关闭长期记忆并删除偏好" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(
    page.getByRole("status", { name: "长期偏好已从云端删除" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "长期记忆尚未启用" }),
  ).toBeVisible();

  await page.goto("/me");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "确认退出" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(
    `/xiaozhi/chat?q=${encodeURIComponent("以后都记住我的租房预算是5000")}`,
  );
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认保存" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});
