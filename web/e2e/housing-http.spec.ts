import { expect, test } from "@playwright/test";

test("local housing HTTP service reaches the agent with historical provenance", async ({
  request,
}) => {
  test.skip(
    !process.env.HOUSING_API_BASE_URL || !process.env.HOUSING_API_KEY,
    "Local housing service is not configured",
  );

  const response = await request.post("/api/chat", {
    data: { message: "找武林广场附近4000元以内的两居室" },
  });
  const body = await response.text();

  expect(response.ok()).toBe(true);
  expect(body).toContain("housing_history_2024");
  expect(body).toContain("2024-11");
  expect(body).toContain('"detailAvailable":false');
  expect(body).toContain('"petsAllowed":null');
  expect(body).toContain("不代表当前仍可出租或当前价格");
  expect(body).not.toContain("must-not-leak");
  expect(body).not.toContain('"raw"');
});
