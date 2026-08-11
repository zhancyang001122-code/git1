import { describe, expect, it, vi } from "vitest";

import {
  createCommunityPostsHandler,
  createDealsHandler,
  createHousesHandler,
  createProductsHandler,
  type BusinessApiRuntimeFactory,
} from "@/features/business/api-handlers";
import { createDemoRepository } from "@/features/business/demo-repository";

const demoRuntime: BusinessApiRuntimeFactory = async () => ({
  business: createDemoRepository(),
  mode: { mode: "demo", reason: "产品演示模式已开启" },
});

function request(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe("public business API handlers", () => {
  it("validates and applies exact house filters with an honest source envelope", async () => {
    const response = await createHousesHandler(demoRuntime)(
      request(
        "/api/houses?city=杭州&maxPrice=3500&roomType=一居室&sort=price_asc&limit=2",
      ),
    );
    const body = (await response.json()) as {
      items: Array<Record<string, unknown>>;
      source: Record<string, unknown>;
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.every(
        (house) =>
          house.city === "杭州" &&
          Number(house.priceMonthly) <= 3_500 &&
          house.roomType === "一居室",
      ),
    ).toBe(true);
    expect(body.source).toEqual({
      source: "supabase_mock",
      label: "演示业务数据",
      isDemo: true,
      mode: "demo",
    });
    expect(
      body.nextCursor === null || typeof body.nextCursor === "string",
    ).toBe(true);
  });

  it("rejects malformed and unknown query parameters before creating repositories", async () => {
    const runtime = vi.fn(demoRuntime);
    const invalidNumber = await createHousesHandler(runtime)(
      request("/api/houses?maxPrice=not-a-number"),
    );
    const unknownParameter = await createHousesHandler(runtime)(
      request("/api/houses?sql=select"),
    );

    expect(invalidNumber.status).toBe(400);
    await expect(invalidNumber.json()).resolves.toMatchObject({
      error: {
        code: "BUSINESS_QUERY_INVALID",
        retryable: false,
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    });
    expect(unknownParameter.status).toBe(400);
    expect(runtime).not.toHaveBeenCalled();
  });

  it("serves deals, products and community posts through one stable pagination envelope", async () => {
    const deals = await createDealsHandler(demoRuntime)(
      request("/api/deals?query=火锅&refundableOnly=true&limit=2"),
    );
    const products = await createProductsHandler(demoRuntime)(
      request("/api/products?query=牛奶&inStockOnly=true&maxPrice=30&limit=3"),
    );
    const posts = await createCommunityPostsHandler(demoRuntime)(
      request("/api/community-posts?category=租房经验&limit=2"),
    );

    for (const response of [deals, products, posts]) {
      expect(response.status).toBe(200);
      await expect(response.clone().json()).resolves.toMatchObject({
        items: expect.any(Array),
        total: expect.any(Number),
        nextCursor: expect.toSatisfy(
          (value: unknown) => value === null || typeof value === "string",
        ),
        source: {
          source: "supabase_mock",
          label: "演示业务数据",
          isDemo: true,
          mode: "demo",
        },
      });
    }

    const productBody = (await products.json()) as {
      items: Array<{ name: string; availableStock: number; price: number }>;
    };
    expect(productBody.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "鲜牛奶 950ml" }),
      ]),
    );
    expect(
      productBody.items.every(
        (product) => product.availableStock > 0 && product.price <= 30,
      ),
    ).toBe(true);
  });

  it("accepts decimal commercial prices while keeping housing rent integral", async () => {
    const products = await createProductsHandler(demoRuntime)(
      request("/api/products?maxPrice=20.5&inStockOnly=true"),
    );
    const body = (await products.json()) as {
      items: Array<{ price: number }>;
    };

    expect(products.status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((product) => product.price <= 20.5)).toBe(true);
  });

  it("normalizes repository failures without leaking internal errors", async () => {
    const runtime: BusinessApiRuntimeFactory = async () => ({
      business: {
        ...createDemoRepository(),
        async listDeals() {
          throw new Error("database password=secret");
        },
      },
      mode: { mode: "supabase" },
    });
    const response = await createDealsHandler(runtime)(
      request("/api/deals?limit=2"),
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(serialized).toContain("INTERNAL_ERROR");
    expect(serialized).not.toContain("password");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
