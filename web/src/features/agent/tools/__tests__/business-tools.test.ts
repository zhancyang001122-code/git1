import { describe, expect, it } from "vitest";

import { createDemoRepository } from "@/features/business/demo-repository";
import { createTaskSixToolRegistry } from "@/features/agent/tools/registry";

import { createToolTestContext } from "./helpers";

describe("business tools", () => {
  it("applies every exact house filter in the repository and returns typed cards", async () => {
    const registry = createTaskSixToolRegistry();
    const tool = registry.get("search_houses");
    const result = await tool.execute(
      {
        city: "杭州",
        district: "拱墅区",
        near_location: "武林广场",
        min_price: 3_000,
        max_price: 3_500,
        room_type: "一居室",
        pets_allowed: true,
        limit: 10,
      },
      createToolTestContext({ business: createDemoRepository() }),
    );

    expect(result.ok).toBe(true);
    expect(result.source).toBe("supabase_mock");
    expect(result.cards?.every((card) => card.kind === "house")).toBe(true);
    const items = (result.data as { items: Array<Record<string, unknown>> })
      .items;
    expect(items.length).toBeGreaterThan(0);
    expect(
      items.every(
        (house) =>
          house.city === "杭州" &&
          house.district === "拱墅区" &&
          Number(house.priceMonthly) >= 3_000 &&
          Number(house.priceMonthly) <= 3_500 &&
          house.roomType === "一居室" &&
          house.petsAllowed === true,
      ),
    ).toBe(true);
    expect(result.data).toMatchObject({
      nearLocationPending: "武林广场",
      historicalYear: 2024,
    });
  });

  it("returns a stable not-found error instead of inventing a house", async () => {
    const result = await createTaskSixToolRegistry()
      .get("get_house_detail")
      .execute(
        { house_id: "20000000-0000-0000-0000-000000009999" },
        createToolTestContext({ business: createDemoRepository() }),
      );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "HOUSE_NOT_FOUND", retryable: false },
    });
  });

  it("does not expose exact stock from a search but does from the stock tool", async () => {
    const registry = createTaskSixToolRegistry();
    const context = createToolTestContext({ business: createDemoRepository() });
    const search = await registry.get("search_products").execute(
      {
        query: "牛奶",
        category: null,
        store_id: null,
        max_price: null,
        in_stock_only: true,
        limit: 6,
      },
      context,
    );
    const product = (search.data as { items: Array<Record<string, unknown>> })
      .items[0]!;

    expect(product).toMatchObject({ name: "鲜牛奶 950ml", inStock: true });
    expect(product).not.toHaveProperty("availableStock");

    const stock = await registry
      .get("get_product_stock")
      .execute({ product_id: String(product.id) }, context);
    expect(stock.data).toMatchObject({
      name: "鲜牛奶 950ml",
      availableStock: 30,
      inStock: true,
    });
  });
});
