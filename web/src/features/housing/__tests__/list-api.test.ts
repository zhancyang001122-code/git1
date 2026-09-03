import { describe, expect, it, vi } from "vitest";

import { createHistoricalHousesHandler } from "@/features/housing/list-api";
import type {
  HistoricalHousingSearchResult,
  HousingRuntime,
  HousingSearchService,
} from "@/features/housing/types";

const searchResult: HistoricalHousingSearchResult = {
  items: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      title: null,
      community: "武林小区",
      address: null,
      district: null,
      distanceM: 23.2,
      monthlyRent: 3_800,
      rentType: "整租",
      layout: "2室1厅",
      areaSqm: null,
      orientation: "南",
      floor: null,
      sourceUrl: "https://example.com/house/1",
      location: { longitude: 120.1552, latitude: 30.2742 },
      datasetPeriod: "2024-11",
    },
  ],
  total: 60_202,
  nextCursor: "offset:48",
  sourceLabel: "2024年11月杭州租房历史快照",
  datasetPeriod: "2024-11",
  isHistorical: true,
  isRealtime: false,
  disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
  requestId: "housing-request-1",
  durationMs: 12,
  warnings: [],
};

function runtime(search: HousingSearchService["search"]): HousingRuntime {
  return {
    mode: "supabase",
    defaultCenter: {
      label: "武林广场",
      longitude: 120.1551,
      latitude: 30.2741,
    },
    radiusM: 2_000,
    service: { search },
  };
}

describe("historical houses list API", () => {
  it("queries the complete active release with server pagination and selected location", async () => {
    const search = vi.fn(async () => searchResult);
    const handler = createHistoricalHousesHandler(() => runtime(search));
    const response = await handler(
      new Request(
        "https://example.com/api/houses?city=杭州&longitude=120.1551&latitude=30.2741&locationLabel=武林广场&maxPrice=3500&roomType=一居室&sort=distance_asc&cursor=offset:24&limit=24",
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
        offset: 24,
        limit: 24,
      },
      expect.any(AbortSignal),
    );
    await expect(response.json()).resolves.toMatchObject({
      total: 60_202,
      nextCursor: "offset:48",
      source: {
        source: "housing_history_2024",
        label: "2024年11月杭州租房历史快照",
        isDemo: false,
        mode: "supabase",
      },
    });
  });

  it("rejects unsupported cities instead of returning Hangzhou records", async () => {
    const search = vi.fn(async () => searchResult);
    const handler = createHistoricalHousesHandler(() => runtime(search));
    const response = await handler(
      new Request(
        "https://example.com/api/houses?city=绍兴&longitude=120.58&latitude=30.01&locationLabel=鲁迅故里",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "HOUSING_UNSUPPORTED_CITY", retryable: false },
    });
    expect(search).not.toHaveBeenCalled();
  });
});
