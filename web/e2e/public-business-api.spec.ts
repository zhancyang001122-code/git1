import { expect, test } from "@playwright/test";

test("public business list APIs match the documented demo contract", async ({
  request,
}) => {
  const houses = await request.get(
    "/api/houses?city=杭州&maxPrice=3500&roomType=一居室&limit=2",
  );
  expect(houses.ok()).toBe(true);
  await expect(houses.json()).resolves.toMatchObject({
    items: expect.any(Array),
    total: expect.any(Number),
    source: {
      source: "supabase_mock",
      label: "演示业务数据",
      isDemo: true,
      mode: "demo",
    },
  });

  for (const path of [
    "/api/deals?limit=2",
    "/api/products?inStockOnly=true&limit=2",
    "/api/community-posts?limit=2",
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      nextCursor: unknown;
      [key: string]: unknown;
    };
    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      source: { source: "supabase_mock", isDemo: true, mode: "demo" },
    });
    expect(
      body.nextCursor === null || typeof body.nextCursor === "string",
    ).toBe(true);
  }

  const invalid = await request.get("/api/houses?sql=select");
  expect(invalid.status()).toBe(400);
  await expect(invalid.json()).resolves.toMatchObject({
    error: {
      code: "BUSINESS_QUERY_INVALID",
      retryable: false,
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    },
  });
});
