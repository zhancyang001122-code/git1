import { describe, expect, it, vi } from "vitest";

import { createDemoRepository } from "@/features/business/demo-repository";
import { createTaskSixToolRegistry } from "@/features/agent/tools/registry";

import { createToolTestContext } from "./helpers";

describe("business tools", () => {
  it("applies every supported house filter and returns typed cards", async () => {
    const registry = createTaskSixToolRegistry();
    const tool = registry.get("search_houses");
    const result = await tool.execute(
      {
        city: "杭州",
        near_location: "武林广场",
        min_price: 3_000,
        max_price: 3_500,
        room_type: "一居室",
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
          Number(house.priceMonthly) >= 3_000 &&
          Number(house.priceMonthly) <= 3_500 &&
          house.roomType === "一居室",
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

  it("reads a selected historical house through the housing service", async () => {
    const id = "21000000-0000-4000-8000-000000000001";
    const getById = vi.fn(async () => ({
      id,
      title: "武林广场旁整租两居",
      community: "环北新村",
      address: "拱墅区武林路 1 号",
      district: "拱墅区",
      monthlyRent: 3_800,
      rentType: "整租",
      layout: "2室1厅",
      areaSqm: 65,
      orientation: "南",
      floor: "中楼层",
      sourceUrl: "https://example.invalid/HZ-001",
      location: { longitude: 120.1552, latitude: 30.2742 },
      datasetPeriod: "2024-11" as const,
      sourceLabel: "2024年11月杭州租房历史快照",
      disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
    }));

    const result = await createTaskSixToolRegistry()
      .get("get_house_detail")
      .execute(
        { house_id: id },
        createToolTestContext({
          housing: {
            mode: "supabase",
            service: { search: vi.fn(), getById },
            defaultCenter: {
              label: "武林广场",
              longitude: 120.1551,
              latitude: 30.2741,
            },
            radiusM: 2_000,
          },
        }),
      );

    expect(getById).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(result).toMatchObject({
      ok: true,
      source: "housing_history_2024",
      cards: [
        {
          kind: "house",
          data: {
            id,
            detailAvailable: true,
            datasetPeriod: "2024-11",
          },
        },
      ],
    });
  });

  it("uses the configured Supabase history service for its WGS84 center", async () => {
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
          near_location: "武林广场",
          min_price: null,
          max_price: 4_000,
          room_type: "两居室",
          limit: 5,
        },
        createToolTestContext({
          housing: {
            mode: "supabase",
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
      detailAvailable: false,
    });
  });

  it("uses the globally selected WGS84 center for a generic nearby housing query", async () => {
    const search = vi.fn(async () => ({
      items: [],
      sourceLabel: "2024年11月杭州租房历史快照",
      datasetPeriod: "2024-11" as const,
      isHistorical: true as const,
      isRealtime: false as const,
      disclaimer: "仅供历史房源参考",
      requestId: "housing-request-selected",
      durationMs: 8,
      warnings: [],
    }));
    const selectedLocation = {
      label: "杭州 · 西湖文化广场",
      city: "杭州",
      amapPoint: { longitude: 120.165, latitude: 30.287 },
      wgs84Point: { longitude: 120.1604, latitude: 30.2894 },
    };

    await createTaskSixToolRegistry()
      .get("search_houses")
      .execute(
        {
          city: "杭州",
          near_location: null,
          min_price: null,
          max_price: 4_000,
          room_type: null,
          limit: 5,
        },
        createToolTestContext({
          selectedLocation,
          housing: {
            mode: "supabase",
            service: { search },
            defaultCenter: {
              label: "武林广场",
              longitude: 120.1585,
              latitude: 30.2764,
            },
            radiusM: 2_000,
          },
        }),
      );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        center: {
          label: selectedLocation.label,
          ...selectedLocation.wgs84Point,
        },
      }),
      expect.any(AbortSignal),
    );
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
