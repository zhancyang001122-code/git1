import { describe, expect, it, vi } from "vitest";

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

  it("uses the local historical HTTP service only for its configured WGS84 center", async () => {
    const search = vi.fn(async () => ({
      items: [
        {
          id: "house_abc",
          title: "武林广场旁整租两居",
          community: "环北新村",
          address: "拱墅区武林路 1 号",
          district: "拱墅区",
          distanceM: 23.2,
          monthlyRent: 3_800,
          rentType: "整租",
          layout: "2室1厅",
          areaSqm: 65,
          orientation: "南",
          floor: "中楼层",
          sourceUrl: "https://example.invalid/HZ-001",
          location: { longitude: 120.1552, latitude: 30.2742 },
          petsPolicy: "unknown" as const,
          datasetPeriod: "2024-11" as const,
        },
      ],
      sourceLabel: "2024年11月杭州租房历史快照",
      datasetPeriod: "2024-11" as const,
      isHistorical: true as const,
      isRealtime: false as const,
      disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
      requestId: "housing-request-1",
      durationMs: 12,
      warnings: [],
    }));
    const result = await createTaskSixToolRegistry()
      .get("search_houses")
      .execute(
        {
          city: "杭州",
          district: "拱墅区",
          near_location: "武林广场",
          min_price: null,
          max_price: 4_000,
          room_type: "两居室",
          pets_allowed: null,
          limit: 5,
        },
        createToolTestContext({
          housing: {
            mode: "http",
            service: { search },
            defaultCenter: {
              label: "武林广场",
              longitude: 120.1551,
              latitude: 30.2741,
            },
            radiusM: 2_000,
          },
        }),
      );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        center: expect.objectContaining({ label: "武林广场" }),
        filters: expect.objectContaining({
          maxPrice: 4_000,
          rentType: null,
          layout: "2室",
        }),
      }),
      expect.any(AbortSignal),
    );
    expect(result).toMatchObject({
      ok: true,
      source: "housing_history_2024",
      resultCount: 1,
      data: {
        datasetPeriod: "2024-11",
        centerLabel: "武林广场",
        isRealtime: false,
      },
    });
    expect(result.cards?.[0]?.data).toMatchObject({
      id: "house_abc",
      petsAllowed: null,
      detailAvailable: false,
    });
  });

  it("refuses to pretend the historical dataset supports pet filtering", async () => {
    const search = vi.fn();
    const result = await createTaskSixToolRegistry()
      .get("search_houses")
      .execute(
        {
          city: "杭州",
          district: null,
          near_location: "武林广场",
          min_price: null,
          max_price: 4_000,
          room_type: null,
          pets_allowed: true,
          limit: 5,
        },
        createToolTestContext({
          housing: {
            mode: "http",
            service: { search },
            defaultCenter: {
              label: "武林广场",
              longitude: 120.1551,
              latitude: 30.2741,
            },
            radiusM: 2_000,
          },
        }),
      );

    expect(search).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      source: "housing_history_2024",
      error: { code: "HOUSING_PET_FILTER_UNAVAILABLE" },
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
