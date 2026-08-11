import { describe, expect, it } from "vitest";

import {
  mapCommunityPostRow,
  mapDealRow,
  mapHouseRow,
  mapProductRow,
  mapStoreRow,
} from "@/features/business/mappers";
import { AppError } from "@/lib/errors";

const id = "20000000-0000-0000-0000-000000000001";

describe("Supabase business row mappers", () => {
  it("converts numeric strings and preserves longitude/latitude order", () => {
    const house = mapHouseRow({
      id,
      name: "武林晴川一居室",
      city: "杭州",
      district: "拱墅区",
      address: "演示地址",
      price_monthly: 3280,
      room_type: "一居室",
      area_sqm: "43.50",
      available: true,
      subway_distance_m: 480,
      longitude: "120.163280",
      latitude: "30.274150",
      description: "历史记录",
      image_urls: null,
      tags: null,
      is_demo: true,
    });

    expect(house.areaSqm).toBe(43.5);
    expect(house.location).toEqual({
      longitude: 120.16328,
      latitude: 30.27415,
    });
    expect(house.tags).toEqual([]);
    expect(house.imageSrc).toBe("/images/home/housing-history-2024.png");
  });

  it("maps deal and store numeric values to domain numbers", () => {
    const deal = mapDealRow({
      id: id.replace(/^2/, "3"),
      store_id: null,
      title: "双人餐",
      merchant_name: "演示商家",
      category: "火锅",
      original_price: "268.00",
      sale_price: "168.00",
      refundable: true,
      refund_policy_label: "未使用可退",
      valid_until: "2027-12-31",
      address: "演示地址",
      longitude: "120.1",
      latitude: "30.2",
      description: "套餐",
      image_url: null,
      tags: ["双人餐"],
      sales_count: 12,
      is_demo: true,
    });
    const store = mapStoreRow({
      id: id.replace(/^2/, "1"),
      name: "演示门店",
      category: "supermarket",
      city: "杭州",
      district: "拱墅区",
      address: "演示地址",
      longitude: "120.2",
      latitude: "30.3",
      delivery_minutes: 30,
      minimum_order: "20.00",
      image_url: null,
      is_demo: true,
    });

    expect(deal.salePrice).toBe(168);
    expect(deal.location.longitude).toBe(120.1);
    expect(store.minimumOrder).toBe(20);
    expect(store.location.latitude).toBe(30.3);
  });

  it("normalizes joined product inventory and nullable arrays", () => {
    const product = mapProductRow({
      id: id.replace(/^2/, "4"),
      store_id: id.replace(/^2/, "1"),
      name: "番茄",
      category: "蔬菜",
      price: "8.90",
      description: "演示商品",
      image_url: null,
      tags: null,
      is_demo: true,
      product_inventory: [{ stock: 40, reserved: 3 }],
    });
    expect(product).toMatchObject({
      price: 8.9,
      stock: 40,
      reserved: 3,
      availableStock: 37,
      tags: [],
    });
  });

  it("preserves whether a Supabase row is real historical data or demo data", () => {
    const house = mapHouseRow({
      id,
      name: "2024 年真实历史房源",
      city: "杭州",
      district: "拱墅区",
      address: "已脱敏地址",
      price_monthly: 3280,
      room_type: "一居室",
      area_sqm: 43,
      available: true,
      subway_distance_m: 480,
      longitude: 120.16,
      latitude: 30.27,
      description: "历史数据",
      image_urls: [],
      tags: [],
      is_demo: false,
    });

    expect(house.isDemo).toBe(false);
  });

  it("normalizes nullable community fields", () => {
    const post = mapCommunityPostRow({
      id: id.replace(/^2/, "5"),
      category: "城市生活",
      title: "周末",
      excerpt: "摘要",
      content: "正文",
      author_name: "演示作者",
      location_label: null,
      cover_image_url: null,
      tags: null,
      like_count: 2,
      comment_count: 1,
      is_demo: true,
    });
    expect(post.locationLabel).toBe("杭州");
    expect(post.tags).toEqual([]);
  });

  it("throws a stable data contract error for malformed rows", () => {
    try {
      mapHouseRow({ id: "bad", name: "", longitude: "not-a-number" });
      throw new Error("expected mapper to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("DATA_CONTRACT_INVALID");
    }
  });
});
