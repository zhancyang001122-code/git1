import { z } from "zod";

import type {
  CommunityPost,
  Deal,
  House,
  Product,
  Store,
} from "@/features/business/domain";
import { AppError } from "@/lib/errors";

const entityId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const numeric = z.coerce.number().finite();
const nullableStrings = z.preprocess(
  (value) => value ?? [],
  z.array(z.string()),
);

const houseRowSchema = z.object({
  id: entityId,
  name: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  address: z.string().min(1),
  price_monthly: z.coerce.number().int().positive(),
  room_type: z.string().min(1),
  area_sqm: numeric.refine((value) => value > 0),
  pets_allowed: z.boolean(),
  available: z.boolean(),
  subway_distance_m: z.coerce.number().int().nonnegative().nullable(),
  longitude: numeric.pipe(z.number().min(-180).max(180)),
  latitude: numeric.pipe(z.number().min(-90).max(90)),
  description: z.string(),
  image_urls: nullableStrings,
  tags: nullableStrings,
  is_demo: z.boolean(),
});

const dealRowSchema = z.object({
  id: entityId,
  store_id: entityId.nullable(),
  title: z.string().min(1),
  merchant_name: z.string().min(1),
  category: z.string().min(1),
  original_price: numeric.nonnegative(),
  sale_price: numeric.nonnegative(),
  refundable: z.boolean(),
  refund_policy_label: z.string(),
  valid_until: z.string().min(1),
  address: z.string().min(1),
  longitude: numeric,
  latitude: numeric,
  description: z.string(),
  image_url: z.string().nullable(),
  tags: nullableStrings,
  sales_count: z.coerce.number().int().nonnegative(),
  is_demo: z.boolean(),
});

const storeRowSchema = z.object({
  id: entityId,
  name: z.string().min(1),
  category: z.enum(["supermarket", "restaurant", "cafe"]),
  city: z.string().min(1),
  district: z.string().min(1),
  address: z.string().min(1),
  longitude: numeric,
  latitude: numeric,
  delivery_minutes: z.coerce.number().int().positive().nullable(),
  minimum_order: numeric.nonnegative(),
  image_url: z.string().nullable(),
  is_demo: z.boolean(),
});

const inventorySchema = z.object({
  stock: z.coerce.number().int().nonnegative(),
  reserved: z.coerce.number().int().nonnegative(),
  available_stock: z.coerce.number().int().nonnegative().optional(),
});
const productRowSchema = z.object({
  id: entityId,
  store_id: entityId,
  name: z.string().min(1),
  category: z.string().min(1),
  price: numeric.nonnegative(),
  description: z.string(),
  image_url: z.string().nullable(),
  tags: nullableStrings,
  is_demo: z.boolean(),
  product_inventory: z.union([
    inventorySchema,
    z.array(inventorySchema).max(1),
    z.null(),
  ]),
});

const postRowSchema = z.object({
  id: entityId,
  category: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  content: z.string(),
  author_name: z.string().min(1),
  location_label: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  tags: nullableStrings,
  like_count: z.coerce.number().int().nonnegative(),
  comment_count: z.coerce.number().int().nonnegative(),
  is_demo: z.boolean(),
});

function parseRow<T>(schema: z.ZodType<T>, row: unknown, entity: string): T {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError({
      code: "DATA_CONTRACT_INVALID",
      message: `${entity} 数据格式无效`,
      cause: result.error,
    });
  }
  return result.data;
}

export function mapHouseRow(row: unknown): House {
  const value = parseRow(houseRowSchema, row, "房源");
  return {
    id: value.id,
    name: value.name,
    city: value.city,
    district: value.district,
    address: value.address,
    priceMonthly: value.price_monthly,
    roomType: value.room_type,
    areaSqm: value.area_sqm,
    petsAllowed: value.pets_allowed,
    available: value.available,
    subwayDistanceM: value.subway_distance_m ?? 0,
    description: value.description,
    imageSrc: value.image_urls[0] ?? "/images/home/housing-history-2024.png",
    tags: value.tags,
    historicalYear: 2024,
    location: { longitude: value.longitude, latitude: value.latitude },
    isDemo: value.is_demo,
  };
}

export function mapDealRow(row: unknown): Deal {
  const value = parseRow(dealRowSchema, row, "团购");
  return {
    id: value.id,
    storeId: value.store_id,
    title: value.title,
    merchantName: value.merchant_name,
    category: value.category,
    originalPrice: value.original_price,
    salePrice: value.sale_price,
    refundable: value.refundable,
    refundPolicyLabel: value.refund_policy_label,
    validUntil: value.valid_until,
    address: value.address,
    description: value.description,
    imageSrc: value.image_url ?? "/images/home/group-buy-hotpot.png",
    tags: value.tags,
    salesCount: value.sales_count,
    location: { longitude: value.longitude, latitude: value.latitude },
    isDemo: value.is_demo,
  };
}

export function mapStoreRow(row: unknown): Store {
  const value = parseRow(storeRowSchema, row, "门店");
  return {
    id: value.id,
    name: value.name,
    city: value.city,
    category: value.category,
    district: value.district,
    address: value.address,
    deliveryMinutes: value.delivery_minutes,
    minimumOrder: value.minimum_order,
    imageSrc: value.image_url ?? "/images/home/fresh-produce.png",
    location: { longitude: value.longitude, latitude: value.latitude },
    isDemo: value.is_demo,
  };
}

export function mapProductRow(row: unknown): Product {
  const value = parseRow(productRowSchema, row, "商品");
  const inventory = Array.isArray(value.product_inventory)
    ? value.product_inventory[0]
    : value.product_inventory;
  const stock = inventory?.stock ?? 0;
  const reserved = inventory?.reserved ?? 0;
  if (reserved > stock)
    throw new AppError({
      code: "DATA_CONTRACT_INVALID",
      message: "商品库存数据格式无效",
    });
  return {
    id: value.id,
    storeId: value.store_id,
    name: value.name,
    category: value.category,
    price: value.price,
    description: value.description,
    imageSrc: value.image_url ?? "/images/home/fresh-produce.png",
    tags: value.tags,
    stock,
    reserved,
    availableStock: inventory?.available_stock ?? stock - reserved,
    isDemo: value.is_demo,
  };
}

export function mapCommunityPostRow(row: unknown): CommunityPost {
  const value = parseRow(postRowSchema, row, "社区内容");
  return {
    id: value.id,
    category: value.category,
    title: value.title,
    excerpt: value.excerpt,
    content: value.content,
    authorName: value.author_name,
    locationLabel: value.location_label ?? "杭州",
    coverImageSrc:
      value.cover_image_url ?? "/images/home/hangzhou-community.png",
    tags: value.tags,
    likeCount: value.like_count,
    commentCount: value.comment_count,
    isDemo: value.is_demo,
  };
}
