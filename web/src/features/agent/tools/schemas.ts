import { z } from "zod";

import {
  nearbySearchInputSchema,
  walkingRouteInputSchema,
} from "@/features/maps/schemas";

export const taskSixToolNames = [
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
] as const;

export type ToolName = (typeof taskSixToolNames)[number];

const nullableString = z.string().nullable();
const databaseUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const nullableNonnegativeNumber = z.number().nonnegative().nullable();
const nullableNonnegativeInteger = z.number().int().nonnegative().nullable();
const productCategories = [
  "乳品",
  "蛋品",
  "水果",
  "蔬菜",
  "肉类",
  "主食",
  "饮料",
  "速冻",
  "日用",
  "早餐",
] as const;

const searchHousesSchema = z
  .object({
    city: z.string(),
    near_location: nullableString,
    min_price: nullableNonnegativeInteger,
    max_price: nullableNonnegativeInteger,
    room_type: nullableString,
    limit: z.number().int().min(1).max(10),
  })
  .strict();

const getHouseDetailSchema = z.object({ house_id: databaseUuid }).strict();

const searchDealsSchema = z
  .object({
    query: nullableString,
    category: nullableString,
    max_price: nullableNonnegativeNumber,
    refundable_only: z.boolean().nullable(),
    limit: z.number().int().min(1).max(10),
  })
  .strict();

const searchProductsSchema = z
  .object({
    query: z.string().trim().min(1).max(80).nullable(),
    category: z.enum(productCategories).nullable(),
    store_id: databaseUuid.nullable(),
    max_price: nullableNonnegativeNumber,
    in_stock_only: z.boolean(),
    limit: z.number().int().min(1).max(12),
  })
  .strict();

const getProductStockSchema = z.object({ product_id: databaseUuid }).strict();

const getUserPreferencesSchema = z
  .object({ scope: z.enum(["housing", "food", "shopping", "all"]) })
  .strict();

const preferenceListValueSchema = z
  .array(z.string().trim().min(1).max(80))
  .min(1)
  .max(20)
  .transform((items) => [...new Set(items)]);

const proposeUserPreferenceSchema = z.discriminatedUnion("key", [
  z
    .object({
      key: z.literal("max_housing_budget"),
      value: z.number().int().nonnegative().max(200_000),
    })
    .strict(),
  ...(
    [
      "preferred_areas",
      "dietary_restrictions",
      "transport_modes",
      "family_profile",
    ] as const
  ).map((key) =>
    z
      .object({ key: z.literal(key), value: preferenceListValueSchema })
      .strict(),
  ),
]);

const searchKnowledgeSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    domain: z.enum(["housing", "group_buy", "market", "platform"]).nullable(),
    category: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,79}$/)
      .nullable(),
    city: z.string().trim().min(1).max(40).nullable(),
    top_k: z.number().int().min(1).max(8),
  })
  .strict();

export const toolInputSchemas = {
  search_houses: searchHousesSchema,
  get_house_detail: getHouseDetailSchema,
  search_deals: searchDealsSchema,
  search_products: searchProductsSchema,
  get_product_stock: getProductStockSchema,
  get_user_preferences: getUserPreferencesSchema,
  propose_user_preference: proposeUserPreferenceSchema,
  search_nearby_places: nearbySearchInputSchema,
  calculate_walking_route: walkingRouteInputSchema,
  search_knowledge: searchKnowledgeSchema,
} as const;

export type ToolInputs = {
  [K in ToolName]: z.infer<(typeof toolInputSchemas)[K]>;
};

export interface ToolContractDefinition {
  name: ToolName;
  description: string;
  strict: true;
  parameters: Record<string, unknown>;
}

export const toolContractDefinitions: readonly ToolContractDefinition[] = [
  {
    name: "search_houses",
    description:
      "Search 2024 historical housing records by city, price, rent type or bedroom layout, and a named nearby location. Never present historical records as current availability.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, default Hangzhou." },
        near_location: {
          type: ["string", "null"],
          description: "Named place used for later geocoding or ranking.",
        },
        min_price: { type: ["integer", "null"], minimum: 0 },
        max_price: { type: ["integer", "null"], minimum: 0 },
        room_type: { type: ["string", "null"] },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: [
        "city",
        "near_location",
        "min_price",
        "max_price",
        "room_type",
        "limit",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "get_house_detail",
    description:
      "Get one house by UUID before comparing its recorded price, coordinates or nearby services.",
    strict: true,
    parameters: {
      type: "object",
      properties: { house_id: { type: "string", format: "uuid" } },
      required: ["house_id"],
      additionalProperties: false,
    },
  },
  {
    name: "search_deals",
    description:
      "Search structured demo group-buy deals by category, merchant, price and refund label.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: ["string", "null"] },
        category: {
          type: ["string", "null"],
          pattern: "^[a-z][a-z0-9_-]{1,79}$",
        },
        max_price: { type: ["number", "null"], minimum: 0 },
        refundable_only: { type: ["boolean", "null"] },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["query", "category", "max_price", "refundable_only", "limit"],
      additionalProperties: false,
    },
  },
  {
    name: "search_products",
    description:
      "Search structured demo supermarket products by keyword, category, price and in-stock status. Set optional filters to null when the user did not provide them; never invent identifiers.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: ["string", "null"],
          minLength: 1,
          maxLength: 80,
          description:
            "A free-text product keyword such as breakfast, or null. Never use an empty string.",
        },
        category: {
          type: ["string", "null"],
          enum: [...productCategories, null],
          description:
            "An exact category from this enum, or null. Put broad intents such as breakfast in query when unsure; never invent a category.",
        },
        store_id: {
          type: ["string", "null"],
          format: "uuid",
          description:
            "A store UUID from a trusted prior result, or null when no store was specified. Never invent a store identifier.",
        },
        max_price: { type: ["number", "null"], minimum: 0 },
        in_stock_only: { type: "boolean", default: true },
        limit: { type: "integer", minimum: 1, maximum: 12, default: 6 },
      },
      required: [
        "query",
        "category",
        "store_id",
        "max_price",
        "in_stock_only",
        "limit",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "get_product_stock",
    description:
      "Get exact current demo stock for one product. Do not infer inventory from descriptive text.",
    strict: true,
    parameters: {
      type: "object",
      properties: { product_id: { type: "string", format: "uuid" } },
      required: ["product_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_user_preferences",
    description:
      "Read explicit, consented long-term preferences for personalization. Never treat them as public knowledge.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["housing", "food", "shopping", "all"],
        },
      },
      required: ["scope"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_user_preference",
    description:
      "Prepare one allowed long-term preference for explicit user confirmation in the application UI. Use an integer value for max_housing_budget; use a non-empty string array for every other key. This tool never persists data and must not infer sensitive traits.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: [
            "max_housing_budget",
            "preferred_areas",
            "dietary_restrictions",
            "transport_modes",
            "family_profile",
          ],
        },
        value: {
          description:
            "Integer for max_housing_budget; non-empty string array for every other allowed key.",
          oneOf: [
            { type: "integer", minimum: 0, maximum: 200000 },
            {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: { type: "string", minLength: 1, maxLength: 80 },
            },
          ],
        },
      },
      required: ["key", "value"],
      additionalProperties: false,
    },
  },
  {
    name: "search_nearby_places",
    description:
      "Use AMap to search real nearby POIs around a coordinate or a named center. Return source-labelled external results.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", minLength: 1 },
        city: { type: "string" },
        center_name: { type: ["string", "null"] },
        longitude: { type: ["number", "null"], minimum: -180, maximum: 180 },
        latitude: { type: ["number", "null"], minimum: -90, maximum: 90 },
        radius_m: {
          type: "integer",
          minimum: 100,
          maximum: 5000,
          default: 2000,
        },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: [
        "keyword",
        "city",
        "center_name",
        "longitude",
        "latitude",
        "radius_m",
        "limit",
      ],
      additionalProperties: false,
      allOf: [
        {
          anyOf: [
            { required: ["center_name"] },
            { required: ["longitude", "latitude"] },
          ],
        },
      ],
    },
  },
  {
    name: "calculate_walking_route",
    description:
      "Use AMap walking route service to calculate distance and duration between two coordinate pairs.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        origin_longitude: { type: "number", minimum: -180, maximum: 180 },
        origin_latitude: { type: "number", minimum: -90, maximum: 90 },
        destination_longitude: {
          type: "number",
          minimum: -180,
          maximum: 180,
        },
        destination_latitude: {
          type: "number",
          minimum: -90,
          maximum: 90,
        },
      },
      required: [
        "origin_longitude",
        "origin_latitude",
        "destination_longitude",
        "destination_latitude",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "search_knowledge",
    description:
      "Retrieve published and currently effective knowledge. Pass the user's complete question as query. Use category only when an exact known category slug is available; otherwise use null. Use for policies, contracts, product capabilities, data freshness, system boundaries, refunds, deposits and delivery rules. Cite returned chunks only when confidence is sufficient and there is no conflict.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 2,
          maxLength: 500,
          description:
            "The user's complete question, preserving facts and constraints instead of replacing it with a generic topic.",
        },
        domain: {
          type: ["string", "null"],
          enum: ["housing", "group_buy", "market", "platform", null],
        },
        category: {
          type: ["string", "null"],
          description:
            "An exact known knowledge category slug, or null. Never invent or translate a category.",
        },
        city: { type: ["string", "null"] },
        top_k: { type: "integer", minimum: 1, maximum: 8, default: 5 },
      },
      required: ["query", "domain", "category", "city", "top_k"],
      additionalProperties: false,
    },
  },
];
