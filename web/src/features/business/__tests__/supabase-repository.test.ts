import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabaseBusinessRepository } from "@/features/business/supabase-repository";

interface Call {
  method: string;
  args: unknown[];
}

function fakeClient(response: {
  data: unknown;
  count?: number | null;
  error?: unknown;
}) {
  const calls: Call[] = [];
  const builder = new Proxy(
    {
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({
          count: response.count ?? null,
          data: response.data,
          error: response.error ?? null,
        }).then(resolve);
      },
    },
    {
      get(target, property) {
        if (property === "then") return target.then.bind(target);
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

const houseRow = {
  id: "20000000-0000-0000-0000-000000000001",
  name: "武林晴川一居室",
  city: "杭州",
  district: "拱墅区",
  address: "演示地址",
  price_monthly: 3280,
  room_type: "一居室",
  area_sqm: "43",
  pets_allowed: true,
  available: true,
  subway_distance_m: 480,
  longitude: "120.16328",
  latitude: "30.27415",
  description: "历史记录",
  image_urls: [],
  tags: [],
  is_demo: true,
};

describe("SupabaseBusinessRepository", () => {
  it("translates validated house filters into explicit stable queries", async () => {
    const fake = fakeClient({ data: [houseRow], count: 1 });
    const repository = createSupabaseBusinessRepository(fake.client);
    const page = await repository.listHouses({
      city: "杭州",
      district: "拱墅区",
      minPrice: 2_500,
      maxPrice: 3500,
      roomType: "一居室",
      petsAllowed: true,
      sort: "price_asc",
      limit: 10,
    });

    expect(page.items[0]?.priceMonthly).toBe(3280);
    expect(fake.calls).toContainEqual({ method: "from", args: ["houses"] });
    expect(
      fake.calls.find((call) => call.method === "select")?.args[0],
    ).not.toContain("*");
    expect(fake.calls).toContainEqual({
      method: "eq",
      args: ["city", "杭州"],
    });
    expect(fake.calls).toContainEqual({
      method: "eq",
      args: ["district", "拱墅区"],
    });
    expect(fake.calls).toContainEqual({
      method: "gte",
      args: ["price_monthly", 2500],
    });
    expect(fake.calls).toContainEqual({
      method: "lte",
      args: ["price_monthly", 3500],
    });
    expect(fake.calls).toContainEqual({
      method: "order",
      args: ["price_monthly", { ascending: true }],
    });
    expect(fake.calls).toContainEqual({ method: "range", args: [0, 9] });
  });

  it("requests an explicit inventory join and maps available stock", async () => {
    const fake = fakeClient({
      data: [
        {
          id: "40000000-0000-0000-0000-000000000001",
          store_id: "10000000-0000-0000-0000-000000000001",
          name: "番茄",
          category: "蔬菜",
          price: "8.90",
          description: "商品",
          image_url: null,
          tags: [],
          is_demo: true,
          product_inventory: { stock: 12, reserved: 2, available_stock: 10 },
        },
      ],
      count: 1,
    });
    const page = await createSupabaseBusinessRepository(
      fake.client,
    ).listProducts({ inStockOnly: true });
    const select = String(
      fake.calls.find((call) => call.method === "select")?.args[0],
    );
    expect(select).toContain(
      "product_inventory!inner(stock,reserved,available_stock)",
    );
    expect(fake.calls).toContainEqual({
      method: "gt",
      args: ["product_inventory.available_stock", 0],
    });
    expect(page.items[0]?.availableStock).toBe(10);
  });

  it("normalizes provider failures to a stable error", async () => {
    const fake = fakeClient({
      data: null,
      error: { message: "database unavailable" },
    });
    await expect(
      createSupabaseBusinessRepository(fake.client).listStores(),
    ).rejects.toMatchObject({ code: "SUPABASE_QUERY_FAILED", retryable: true });
  });

  it("rejects unsafe pagination cursors before querying", async () => {
    const fake = fakeClient({ data: [] });
    await expect(
      createSupabaseBusinessRepository(fake.client).listHouses({
        cursor: "drop table",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(fake.calls).toHaveLength(0);
  });
});
