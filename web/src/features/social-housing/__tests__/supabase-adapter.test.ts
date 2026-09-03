import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SocialHousingSupabaseAdapter } from "@/features/social-housing/supabase-adapter";
import type { SocialHousingSearchInput } from "@/features/social-housing/types";

function thenableResult<T>(value: T) {
  const query = {
    abortSignal: vi.fn(() => query),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((result: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
  return query;
}

const input: SocialHousingSearchInput = {
  city: "杭州",
  center: {
    label: "武林广场",
    longitude: 120.1551,
    latitude: 30.2741,
  },
  radiusM: null,
  filters: {
    minPrice: null,
    maxPrice: 3_500,
    rentType: null,
    layout: "1室",
    minArea: null,
    maxArea: null,
    district: null,
  },
  sort: "distance",
  offset: 0,
  limit: 24,
};

const row = {
  id: "30000000-0000-4000-8000-000000000001",
  title: "萧山区一居室个人转租",
  summary: "近地铁的一居室转租线索。",
  city: "杭州",
  district: "萧山区",
  community: "建设三路附近",
  address: null,
  price_min_monthly: 950,
  price_max_monthly: 1200,
  rent_type: "整租",
  layout: "1室1厅",
  bedrooms: 1,
  area_sqm: null,
  longitude: "120.251200",
  latitude: "30.183800",
  coordinate_system: "wgs84",
  published_at: "2026-06-26T08:00:00.000Z",
  last_seen_at: "2026-09-03T02:19:00.000Z",
  source_platforms: ["xiaohongshu"],
  source_count: 1,
  verification_label: "房态未经核验",
  distance_m: 1240,
  total_count: 1,
};

describe("SocialHousingSupabaseAdapter", () => {
  it("maps approved lead rows without leaking raw post content", async () => {
    const query = thenableResult({ data: [row], error: null });
    const rpc = vi.fn(() => query);
    const adapter = new SocialHousingSupabaseAdapter({
      client: { rpc } as unknown as SupabaseClient,
    });

    const result = await adapter.search(input);

    expect(rpc).toHaveBeenCalledWith("search_social_housing_leads", {
      p_city: "杭州",
      p_min_price: null,
      p_max_price: 3_500,
      p_rent_type: null,
      p_bedrooms: 1,
      p_center_longitude: 120.1551,
      p_center_latitude: 30.2741,
      p_radius_m: null,
      p_sort: "distance",
      p_offset: 0,
      p_limit: 24,
    });
    expect(result.items[0]).toMatchObject({
      coordinateSystem: "wgs84",
      monthlyRentMin: 950,
      monthlyRentMax: 1_200,
      sourcePlatforms: ["xiaohongshu"],
      sourceCount: 1,
      verificationLabel: "房态未经核验",
    });
    expect(JSON.stringify(result)).not.toContain("xsec_token");
    expect(JSON.stringify(result)).not.toContain("nickname");
  });

  it("returns canonical source links from the detail RPC", async () => {
    const query = thenableResult({
      data: [
        {
          ...row,
          distance_m: null,
          total_count: null,
          sources: [
            {
              platform: "xiaohongshu",
              canonical_url:
                "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b",
              source_published_at: "2026-06-26T08:00:00.000Z",
              last_checked_at: "2026-09-03T02:19:00.000Z",
              source_status: "not_obviously_closed",
            },
          ],
        },
      ],
      error: null,
    });
    const rpc = vi.fn(() => query);
    const adapter = new SocialHousingSupabaseAdapter({
      client: { rpc } as unknown as SupabaseClient,
    });

    const result = await adapter.getById(row.id);

    expect(rpc).toHaveBeenCalledWith("get_social_housing_lead_detail", {
      p_id: row.id,
    });
    expect(result?.sources).toEqual([
      expect.objectContaining({
        platform: "xiaohongshu",
        canonicalUrl:
          "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("xsec_token");
  });
});
