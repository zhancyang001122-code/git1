import { describe, expect, it, vi } from "vitest";

import { HousingHttpAdapter } from "@/features/housing/http-adapter";

const input = {
  city: "杭州",
  center: {
    label: "武林广场",
    latitude: 30.2741,
    longitude: 120.1551,
  },
  radiusM: 2_000,
  filters: {
    minPrice: null,
    maxPrice: 4_000,
    rentType: "整租" as const,
    layout: null,
    minArea: null,
    maxArea: null,
    district: "拱墅区",
  },
  sort: "distance" as const,
  limit: 5,
};

const successResponse = {
  ok: true,
  data: {
    returned_count: 1,
    items: [
      {
        listing_id: "house_abc",
        title: "武林广场旁整租两居",
        community: "环北新村",
        address: "拱墅区武林路 1 号",
        district: "拱墅区",
        distance_m: 23.2,
        monthly_rent: 3_800,
        rent_type: "整租",
        layout: "2室1厅",
        area_sqm: 65,
        orientation: "南",
        floor: "中楼层",
        source_url: "https://example.invalid/HZ-001",
        longitude: 120.1552,
        latitude: 30.2742,
      },
    ],
  },
  source: {
    label: "2024年11月杭州租房历史快照",
    dataset_period: "2024-11",
    is_historical: true,
    is_realtime: false,
    disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
  },
  meta: { request_id: "req-1", duration_ms: 12, warnings: [] },
};

describe("HousingHttpAdapter", () => {
  it("sends a server-authenticated request and maps the stable contract", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(successResponse, {
        headers: { "x-request-id": "req-1" },
      }),
    );
    const adapter = new HousingHttpAdapter({
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "local-key-that-is-at-least-32-characters",
      fetcher: fetcher as typeof fetch,
    });

    const result = await adapter.search(input);

    expect(result.items[0]).toMatchObject({
      id: "house_abc",
      title: "武林广场旁整租两居",
      monthlyRent: 3_800,
      datasetPeriod: "2024-11",
    });
    expect(result.isHistorical).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("http://127.0.0.1:8000/v1/houses/search");
    expect(init.headers).toMatchObject({
      authorization: "Bearer local-key-that-is-at-least-32-characters",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      city: "杭州",
      center: {
        lat: 30.2741,
        lng: 120.1551,
        coordinate_system: "WGS84",
      },
      radius_m: 2_000,
      filters: { price_max: 4_000, district: "拱墅区" },
    });
  });

  it("normalizes a stable upstream error without exposing its body", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          ok: false,
          error: {
            code: "DATA_UNAVAILABLE",
            message: "历史房源数据库暂不可用",
            retryable: true,
          },
          meta: { request_id: "req-upstream" },
        },
        { status: 503 },
      ),
    );
    const adapter = new HousingHttpAdapter({
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "local-key-that-is-at-least-32-characters",
      fetcher: fetcher as typeof fetch,
    });

    await expect(adapter.search(input)).rejects.toMatchObject({
      code: "HOUSING_DATA_UNAVAILABLE",
      retryable: true,
    });
  });

  it("rejects a malformed success response", async () => {
    const adapter = new HousingHttpAdapter({
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "local-key-that-is-at-least-32-characters",
      fetcher: vi.fn(async () => Response.json({ ok: true })) as typeof fetch,
    });

    await expect(adapter.search(input)).rejects.toMatchObject({
      code: "HOUSING_INVALID_RESPONSE",
    });
  });
});
