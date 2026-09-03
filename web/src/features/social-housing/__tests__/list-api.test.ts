import { describe, expect, it, vi } from "vitest";

import { createSocialHousingLeadsHandler } from "@/features/social-housing/list-api";
import type {
  SocialHousingRuntime,
  SocialHousingSearchResult,
  SocialHousingSearchService,
} from "@/features/social-housing/types";

const searchResult: SocialHousingSearchResult = {
  items: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      title: "萧山区一居室个人转租",
      summary: "近地铁的一居室转租线索。",
      community: "建设三路附近",
      address: null,
      district: "萧山区",
      distanceM: 1_240,
      monthlyRentMin: 950,
      monthlyRentMax: 1_200,
      rentType: "整租",
      layout: "1室1厅",
      areaSqm: null,
      location: { longitude: 120.2512, latitude: 30.1838 },
      coordinateSystem: "wgs84",
      publishedAt: "2026-06-26T08:00:00.000Z",
      lastSeenAt: "2026-09-03T02:19:00.000Z",
      sourcePlatforms: ["xiaohongshu"],
      sourceCount: 1,
      verificationLabel: "房态未经核验",
    },
  ],
  total: 1,
  nextCursor: null,
  sourceLabel: "近期社交平台租房线索",
  disclaimer: "来自公开帖子并经字段清洗，房态、身份和价格均未经核验",
  requestId: "social-housing-request-1",
  durationMs: 12,
  warnings: [],
};

function runtime(
  search: SocialHousingSearchService["search"],
): SocialHousingRuntime {
  return {
    mode: "supabase",
    service: { search },
    defaultCenter: {
      label: "武林广场",
      longitude: 120.1551,
      latitude: 30.2741,
    },
  };
}

describe("social housing leads list API", () => {
  it("queries approved leads around the selected WGS84 location", async () => {
    const search = vi.fn(async () => searchResult);
    const handler = createSocialHousingLeadsHandler(() => runtime(search));
    const response = await handler(
      new Request(
        "https://example.com/api/housing-leads?city=杭州&longitude=120.1551&latitude=30.2741&locationLabel=武林广场&maxPrice=3500&roomType=一居室&sort=distance_asc&limit=24",
      ),
    );

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith(
      {
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
      },
      expect.any(AbortSignal),
    );
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      source: {
        source: "social_housing_leads",
        label: "近期社交平台租房线索",
        isVerified: false,
        mode: "supabase",
      },
    });
  });

  it("rejects duplicate and unknown query parameters", async () => {
    const search = vi.fn(async () => searchResult);
    const handler = createSocialHousingLeadsHandler(() => runtime(search));
    const response = await handler(
      new Request(
        "https://example.com/api/housing-leads?city=杭州&city=绍兴&unknown=value",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BUSINESS_QUERY_INVALID", retryable: false },
    });
    expect(search).not.toHaveBeenCalled();
  });
});
