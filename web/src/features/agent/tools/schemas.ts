import { z } from "zod";

export const taskSixToolNames = [
  "search_houses",
  "get_house_detail",
  "search_deals",
  "search_products",
  "get_product_stock",
  "get_user_preferences",
  "save_user_preference",
] as const;

export type ToolName = (typeof taskSixToolNames)[number];

const nullableString = z.string().nullable();
const databaseUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const nullableNonnegativeNumber = z.number().nonnegative().nullable();
const nullableNonnegativeInteger = z.number().int().nonnegative().nullable();

const searchHousesSchema = z
  .object({
    city: z.string(),
    district: nullableString,
    near_location: nullableString,
    min_price: nullableNonnegativeInteger,
    max_price: nullableNonnegativeInteger,
    room_type: nullableString,
    pets_allowed: z.boolean().nullable(),
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
    query: nullableString,
    category: nullableString,
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

const saveUserPreferenceSchema = z
  .object({
    key: z.enum([
      "max_housing_budget",
      "pets",
      "preferred_areas",
      "dietary_restrictions",
      "transport_modes",
      "family_profile",
    ]),
    value: z.unknown(),
    consent_confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (!Object.hasOwn(value, "value")) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "偏好值不能为空缺失",
      });
    }
  });

export const toolInputSchemas = {
  search_houses: searchHousesSchema,
  get_house_detail: getHouseDetailSchema,
  search_deals: searchDealsSchema,
  search_products: searchProductsSchema,
  get_product_stock: getProductStockSchema,
  get_user_preferences: getUserPreferencesSchema,
  save_user_preference: saveUserPreferenceSchema,
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
      "Search 2024 historical housing records with exact structured filters. Use this for recorded rent, room type, pet, area and availability; never present historical availability as current.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, default Hangzhou." },
        district: { type: ["string", "null"] },
        near_location: {
          type: ["string", "null"],
          description: "Named place used for later geocoding or ranking.",
        },
        min_price: { type: ["integer", "null"], minimum: 0 },
        max_price: { type: ["integer", "null"], minimum: 0 },
        room_type: { type: ["string", "null"] },
        pets_allowed: { type: ["boolean", "null"] },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: [
        "city",
        "district",
        "near_location",
        "min_price",
        "max_price",
        "room_type",
        "pets_allowed",
        "limit",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "get_house_detail",
    description:
      "Get one house by UUID before comparing its price, coordinates, pet policy or nearby services.",
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
        category: { type: ["string", "null"] },
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
      "Search structured demo supermarket products by keyword, category, price and in-stock status.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        store_id: { type: ["string", "null"], format: "uuid" },
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
    name: "save_user_preference",
    description:
      "Save one explicit user preference only after the user asks or clearly consents. Do not infer sensitive traits.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: [
            "max_housing_budget",
            "pets",
            "preferred_areas",
            "dietary_restrictions",
            "transport_modes",
            "family_profile",
          ],
        },
        value: {},
        consent_confirmed: { type: "boolean", const: true },
      },
      required: ["key", "value", "consent_confirmed"],
      additionalProperties: false,
    },
  },
];
