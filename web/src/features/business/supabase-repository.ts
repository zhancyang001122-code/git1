import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  mapCommunityPostRow,
  mapDealRow,
  mapHouseRow,
  mapProductRow,
  mapStoreRow,
} from "@/features/business/mappers";
import type { Page } from "@/features/business/domain";
import type { BusinessRepository } from "@/features/business/repository";
import { AppError } from "@/lib/errors";

const HOUSE_COLUMNS =
  "id,name,city,district,address,price_monthly,room_type,area_sqm,available,subway_distance_m,longitude,latitude,description,image_urls,tags,is_demo";
const DEAL_COLUMNS =
  "id,store_id,title,merchant_name,category,original_price,sale_price,refundable,refund_policy_label,valid_until,address,longitude,latitude,description,image_url,tags,sales_count,is_demo";
const STORE_COLUMNS =
  "id,name,category,city,district,address,longitude,latitude,delivery_minutes,minimum_order,image_url,is_demo";
const PRODUCT_COLUMNS =
  "id,store_id,name,category,price,description,image_url,tags,is_demo,product_inventory!inner(stock,reserved,available_stock)";
const POST_COLUMNS =
  "id,category,title,excerpt,content,author_name,location_label,cover_image_url,tags,like_count,comment_count,is_demo";

const optionalText = z.string().trim().min(1).max(80).optional();
const paging = {
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(24).optional(),
};
const houseFilterSchema = z
  .object({
    city: optionalText,
    minPrice: z.number().int().min(0).max(200000).optional(),
    maxPrice: z.number().int().min(0).max(200000).optional(),
    roomType: optionalText,
    sort: z.enum(["recommended", "price_asc", "price_desc"]).optional(),
    ...paging,
  })
  .strict();
const dealFilterSchema = z
  .object({
    query: optionalText,
    category: optionalText,
    maxPrice: z.number().min(0).max(100000).optional(),
    refundableOnly: z.boolean().optional(),
    ...paging,
  })
  .strict();
const productFilterSchema = z
  .object({
    query: optionalText,
    category: optionalText,
    storeId: optionalText,
    maxPrice: z.number().min(0).max(100000).optional(),
    inStockOnly: z.boolean().optional(),
    ...paging,
  })
  .strict();
const postFilterSchema = z
  .object({ query: optionalText, category: optionalText, ...paging })
  .strict();

function pagination(cursor?: string, limit = 24) {
  if (!cursor) return { from: 0, limit, to: limit - 1 };
  const match = /^offset:(\d{1,7})$/.exec(cursor);
  if (!match)
    throw new AppError({ code: "INVALID_CURSOR", message: "分页游标无效" });
  const from = Number(match[1]);
  return { from, limit, to: from + limit - 1 };
}

function safeSearch(value: string) {
  return value
    .replace(/[%_,().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryError(error: unknown, resource: string): never {
  throw new AppError({
    code: "SUPABASE_QUERY_FAILED",
    message: `${resource}查询暂时不可用`,
    retryable: true,
    cause: error,
  });
}

function pageOf<T>(
  items: readonly T[],
  total: number,
  from: number,
  limit: number,
): Page<T> {
  return {
    items,
    total,
    nextCursor:
      from + items.length < total && items.length >= limit
        ? `offset:${from + items.length}`
        : null,
  };
}

export function createSupabaseBusinessRepository(
  client: SupabaseClient,
): BusinessRepository {
  return {
    async listHouses(input) {
      const filter = houseFilterSchema.parse(input);
      const { from, limit, to } = pagination(filter.cursor, filter.limit);
      let query = client
        .from("houses")
        .select(HOUSE_COLUMNS, { count: "exact" })
        .eq("available", true);
      if (filter.city) query = query.eq("city", filter.city);
      if (filter.minPrice !== undefined)
        query = query.gte("price_monthly", filter.minPrice);
      if (filter.maxPrice !== undefined)
        query = query.lte("price_monthly", filter.maxPrice);
      if (filter.roomType) query = query.eq("room_type", filter.roomType);
      if (filter.sort === "price_asc")
        query = query.order("price_monthly", { ascending: true });
      else if (filter.sort === "price_desc")
        query = query.order("price_monthly", { ascending: false });
      query = query.order("id", { ascending: true }).range(from, to);
      const result = await query;
      if (result.error) queryError(result.error, "房源");
      const items = (result.data ?? []).map(mapHouseRow);
      return pageOf(items, result.count ?? items.length, from, limit);
    },

    async getHouse(id) {
      const result = await client
        .from("houses")
        .select(HOUSE_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (result.error) queryError(result.error, "房源");
      return result.data ? mapHouseRow(result.data) : null;
    },

    async listDeals(input) {
      const filter = dealFilterSchema.parse(input);
      const { from, limit, to } = pagination(filter.cursor, filter.limit);
      let query = client
        .from("deals")
        .select(DEAL_COLUMNS, { count: "exact" })
        .eq("active", true);
      if (filter.query) {
        const value = safeSearch(filter.query);
        if (value)
          query = query.or(
            `title.ilike.%${value}%,merchant_name.ilike.%${value}%`,
          );
      }
      if (filter.category) query = query.eq("category", filter.category);
      if (filter.maxPrice !== undefined)
        query = query.lte("sale_price", filter.maxPrice);
      if (filter.refundableOnly) query = query.eq("refundable", true);
      query = query
        .order("sale_price", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      const result = await query;
      if (result.error) queryError(result.error, "团购");
      const items = (result.data ?? []).map(mapDealRow);
      return pageOf(items, result.count ?? items.length, from, limit);
    },

    async getDeal(id) {
      const result = await client
        .from("deals")
        .select(DEAL_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (result.error) queryError(result.error, "团购");
      return result.data ? mapDealRow(result.data) : null;
    },

    async listStores() {
      const result = await client
        .from("stores")
        .select(STORE_COLUMNS)
        .eq("active", true)
        .order("name", { ascending: true })
        .order("id", { ascending: true });
      if (result.error) queryError(result.error, "门店");
      return (result.data ?? []).map(mapStoreRow);
    },

    async getStore(id) {
      const result = await client
        .from("stores")
        .select(STORE_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (result.error) queryError(result.error, "门店");
      return result.data ? mapStoreRow(result.data) : null;
    },

    async listProducts(input) {
      const filter = productFilterSchema.parse(input);
      const { from, limit, to } = pagination(filter.cursor, filter.limit);
      let query = client
        .from("products")
        .select(PRODUCT_COLUMNS, { count: "exact" })
        .eq("active", true);
      if (filter.query) {
        const value = safeSearch(filter.query);
        if (value)
          query = query.or(`name.ilike.%${value}%,category.ilike.%${value}%`);
      }
      if (filter.category) query = query.eq("category", filter.category);
      if (filter.storeId) query = query.eq("store_id", filter.storeId);
      if (filter.maxPrice !== undefined)
        query = query.lte("price", filter.maxPrice);
      if (filter.inStockOnly)
        query = query.gt("product_inventory.available_stock", 0);
      query = query
        .order("price", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      const result = await query;
      if (result.error) queryError(result.error, "商品");
      const items = (result.data ?? []).map(mapProductRow);
      return pageOf(items, result.count ?? items.length, from, limit);
    },

    async getProduct(id) {
      const result = await client
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (result.error) queryError(result.error, "商品");
      return result.data ? mapProductRow(result.data) : null;
    },

    async listCommunityPosts(input) {
      const filter = postFilterSchema.parse(input);
      const { from, limit, to } = pagination(filter.cursor, filter.limit);
      let query = client
        .from("community_posts")
        .select(POST_COLUMNS, { count: "exact" })
        .eq("published", true);
      if (filter.query) {
        const value = safeSearch(filter.query);
        if (value)
          query = query.or(`title.ilike.%${value}%,excerpt.ilike.%${value}%`);
      }
      if (filter.category) query = query.eq("category", filter.category);
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      const result = await query;
      if (result.error) queryError(result.error, "社区内容");
      const items = (result.data ?? []).map(mapCommunityPostRow);
      return pageOf(items, result.count ?? items.length, from, limit);
    },

    async getCommunityPost(id) {
      const result = await client
        .from("community_posts")
        .select(POST_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (result.error) queryError(result.error, "社区内容");
      return result.data ? mapCommunityPostRow(result.data) : null;
    },
  };
}
