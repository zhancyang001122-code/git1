import { describe, expect, it } from "vitest";

import {
  demoCommunityPosts,
  demoDeals,
  demoHouses,
  demoProducts,
} from "@/features/business/demo-data";
import { createDemoRepository } from "@/features/business/demo-repository";

describe("DemoBusinessRepository", () => {
  it("keeps the fixed seed counts aligned with the future Supabase seed", async () => {
    const repository = createDemoRepository();

    expect(demoHouses).toHaveLength(12);
    expect(demoDeals).toHaveLength(8);
    expect(demoProducts).toHaveLength(16);
    expect(demoCommunityPosts).toHaveLength(10);
    await expect(repository.listHouses({})).resolves.toMatchObject({
      total: 11,
    });
  });

  it("applies every housing constraint and excludes unavailable records", async () => {
    const repository = createDemoRepository();

    const result = await repository.listHouses({
      maxPrice: 3500,
      roomType: "一居室",
      petsAllowed: true,
      sort: "price_asc",
    });

    expect(result.items.map((house) => house.id)).toEqual([
      "20000000-0000-0000-0000-000000000010",
      "20000000-0000-0000-0000-000000000001",
      "20000000-0000-0000-0000-000000000008",
      "20000000-0000-0000-0000-000000000002",
    ]);
    expect(result.items.every((house) => house.available)).toBe(true);
    expect(
      result.items.every(
        (house) =>
          house.priceMonthly <= 3500 &&
          house.roomType === "一居室" &&
          house.petsAllowed,
      ),
    ).toBe(true);
  });

  it("excludes out-of-stock products when requested", async () => {
    const repository = createDemoRepository();

    const result = await repository.listProducts({ inStockOnly: true });

    expect(result.total).toBe(15);
    expect(result.items.map((product) => product.id)).not.toContain(
      "40000000-0000-0000-0000-000000000013",
    );
    expect(result.items.every((product) => product.availableStock > 0)).toBe(
      true,
    );
  });

  it("returns stable price ordering and null for an unknown detail id", async () => {
    const repository = createDemoRepository();

    const first = await repository.listHouses({ sort: "price_asc" });
    const second = await repository.listHouses({ sort: "price_asc" });

    expect(second.items.map((house) => house.id)).toEqual(
      first.items.map((house) => house.id),
    );
    expect(first.items.map((house) => house.priceMonthly)).toEqual(
      [...first.items]
        .sort(
          (left, right) =>
            left.priceMonthly - right.priceMonthly ||
            left.id.localeCompare(right.id),
        )
        .map((house) => house.priceMonthly),
    );
    await expect(repository.getHouse("missing-house")).resolves.toBeNull();
  });
});
