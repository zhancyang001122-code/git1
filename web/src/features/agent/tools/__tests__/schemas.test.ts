import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  toolContractDefinitions,
  toolInputSchemas,
  type ToolName,
} from "@/features/agent/tools/schemas";

const taskSevenTools: readonly ToolName[] = [
  "search_houses",
  "get_house_detail",
  "search_deals",
  "search_products",
  "get_product_stock",
  "get_user_preferences",
  "propose_user_preference",
  "search_nearby_places",
  "calculate_walking_route",
  "search_knowledge",
];

describe("Task 7 tool schemas", () => {
  it("keeps provider definitions identical to the authoritative root contract", () => {
    const contract = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "../contracts/tool-contracts.json"),
        "utf8",
      ),
    ) as {
      tools: Array<{
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      }>;
    };
    const byName = (left: { name: string }, right: { name: string }) =>
      left.name.localeCompare(right.name);
    expect([...toolContractDefinitions].sort(byName)).toEqual(
      [...contract.tools].sort(byName),
    );
    expect(contract.tools.map((tool) => tool.name).sort()).toEqual(
      [...taskSevenTools].sort(),
    );
  });

  it("accepts a complete house query but rejects extra and out-of-range fields", () => {
    const valid = {
      city: "杭州",
      near_location: "武林广场",
      min_price: 2_000,
      max_price: 3_500,
      room_type: "一居室",
      limit: 5,
    };

    expect(toolInputSchemas.search_houses.safeParse(valid).success).toBe(true);
    expect(
      toolInputSchemas.search_houses.safeParse({ ...valid, limit: 11 }).success,
    ).toBe(false);
    expect(
      toolInputSchemas.search_houses.safeParse({ ...valid, sql: "select *" })
        .success,
    ).toBe(false);
    expect(
      toolInputSchemas.search_houses.safeParse({
        ...valid,
        district: "拱墅区",
      }).success,
    ).toBe(false);
    const missingCity: Partial<typeof valid> = { ...valid };
    delete missingCity.city;
    expect(toolInputSchemas.search_houses.safeParse(missingCity).success).toBe(
      false,
    );
  });

  it("validates UUIDs and nullable product filters exactly", () => {
    expect(
      toolInputSchemas.search_products.safeParse({
        query: "牛奶",
        category: null,
        store_id: null,
        max_price: null,
        in_stock_only: true,
        limit: 6,
      }).success,
    ).toBe(true);
    expect(
      toolInputSchemas.get_product_stock.safeParse({
        product_id: "40000000-0000-0000-0000-000000000001",
      }).success,
    ).toBe(true);
    expect(
      toolInputSchemas.get_product_stock.safeParse({ product_id: "not-a-uuid" })
        .success,
    ).toBe(false);
    expect(
      toolInputSchemas.search_products.safeParse({
        query: "早餐",
        category: "早餐",
        store_id: null,
        max_price: 30,
        in_stock_only: true,
        limit: 6,
      }).success,
    ).toBe(true);
    expect(
      toolInputSchemas.search_products.safeParse({
        query: "早餐",
        category: "食品",
        store_id: null,
        max_price: 30,
        in_stock_only: true,
        limit: 6,
      }).success,
    ).toBe(false);
    expect(
      toolInputSchemas.search_products.safeParse({
        query: "",
        category: null,
        store_id: null,
        max_price: 30,
        in_stock_only: true,
        limit: 6,
      }).success,
    ).toBe(false);

    const productContract = toolContractDefinitions.find(
      (definition) => definition.name === "search_products",
    );
    expect(productContract?.parameters).toMatchObject({
      properties: {
        query: { minLength: 1 },
        category: {
          enum: expect.arrayContaining(["早餐", null]),
        },
        store_id: {
          description: expect.stringMatching(/UUID.*null/u),
        },
      },
    });
  });

  it("accepts only proposal data for a supported preference key", () => {
    expect(
      toolInputSchemas.propose_user_preference.safeParse({
        key: "max_housing_budget",
        value: 3_500,
      }).success,
    ).toBe(true);
    expect(
      toolInputSchemas.propose_user_preference.safeParse({
        key: "dietary_restrictions",
        value: ["不吃辣"],
      }).success,
    ).toBe(true);
    expect(
      toolInputSchemas.propose_user_preference.safeParse({
        key: "dietary_restrictions",
        value: "不吃辣",
      }).success,
    ).toBe(false);
    expect(
      toolInputSchemas.propose_user_preference.safeParse({
        key: "max_housing_budget",
        value: 3_500,
        consent_confirmed: true,
      }).success,
    ).toBe(false);
    expect(
      toolInputSchemas.propose_user_preference.safeParse({
        key: "medical_history",
        value: "secret",
      }).success,
    ).toBe(false);

    const proposalContract = toolContractDefinitions.find(
      (definition) => definition.name === "propose_user_preference",
    );
    expect(proposalContract?.description).toMatch(/array/i);
  });
});
