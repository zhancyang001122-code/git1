import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { HistoricalHousingSupabaseAdapter } from "@/features/housing/supabase-adapter";
import type { HousingSearchInput } from "@/features/housing/types";

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

function hangingResult() {
  let signal: AbortSignal | undefined;
  const query = {
    abortSignal: vi.fn((value: AbortSignal) => {
      signal = value;
      return query;
    }),
    then: <TResult1 = never, TResult2 = never>(
      onfulfilled?:
        ((result: never) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) =>
      new Promise<never>((_, reject) => {
        const abort = () => reject(signal?.reason ?? new Error("aborted"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      }).then(onfulfilled, onrejected),
  };
  return query;
}

const input: HousingSearchInput = {
  city: "杭州",
  center: {
    label: "武林广场",
    longitude: 120.1551,
    latitude: 30.2741,
  },
  radiusM: 2_000,
  filters: {
    minPrice: 2_500,
    maxPrice: 4_000,
    rentType: "整租",
    layout: "2室1厅",
    minArea: null,
    maxArea: null,
    district: null,
  },
  sort: "distance",
  limit: 5,
};

const row = {
  id: "20000000-0000-4000-8000-000000000001",
  title: null,
  city: "杭州",
  district: null,
  address: null,
  community: "武林小区",
  price_monthly: 3_800,
  rent_type: "整租",
  layout: "2室1厅",
  bedrooms: 2,
  area_sqm: null,
  floor: null,
  orientation: "南",
  longitude: "120.155200",
  latitude: "30.274200",
  source_url: "https://example.com/house/1",
  dataset_period: "2024-11",
  source_label: "2024年11月杭州租房历史快照",
  disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
  distance_m: 23.2,
  total_count: 1,
};

describe("HistoricalHousingSupabaseAdapter", () => {
  it("maps validated filters and coordinates to the RPC without swapping longitude and latitude", async () => {
    const query = thenableResult({ data: [row], error: null });
    const rpc = vi.fn(() => query);
    const adapter = new HistoricalHousingSupabaseAdapter({
      client: { rpc } as unknown as SupabaseClient,
    });

    const result = await adapter.search(input);

    expect(rpc).toHaveBeenCalledWith("search_historical_houses", {
      p_city: "杭州",
      p_min_price: 2_500,
      p_max_price: 4_000,
      p_rent_type: "整租",
      p_bedrooms: 2,
      p_center_longitude: 120.1551,
      p_center_latitude: 30.2741,
      p_radius_m: 2_000,
      p_sort: "distance",
      p_offset: 0,
      p_limit: 5,
    });
    expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result).toMatchObject({
      sourceLabel: "2024年11月杭州租房历史快照",
      datasetPeriod: "2024-11",
      isHistorical: true,
      isRealtime: false,
      disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
    });
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        title: null,
        district: null,
        address: null,
        areaSqm: null,
        floor: null,
        location: { longitude: 120.1552, latitude: 30.2742 },
      }),
    );
  });

  it("rejects invalid or currently unsupported filters before calling Supabase", async () => {
    const rpc = vi.fn();
    const adapter = new HistoricalHousingSupabaseAdapter({
      client: { rpc } as unknown as SupabaseClient,
    });

    await expect(
      adapter.search({
        ...input,
        filters: { ...input.filters, district: "拱墅区" },
      }),
    ).rejects.toMatchObject({
      code: "HOUSING_INVALID_ARGUMENT",
      status: 400,
      retryable: false,
    });
    await expect(
      adapter.search({
        ...input,
        filters: { ...input.filters, minPrice: 5_000, maxPrice: 3_000 },
      }),
    ).rejects.toMatchObject({ code: "HOUSING_INVALID_ARGUMENT" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("normalizes invalid database rows instead of leaking a Supabase shape", async () => {
    const query = thenableResult({
      data: [{ ...row, longitude: "invalid" }],
      error: null,
    });
    const adapter = new HistoricalHousingSupabaseAdapter({
      client: { rpc: vi.fn(() => query) } as unknown as SupabaseClient,
    });

    await expect(adapter.search(input)).rejects.toMatchObject({
      code: "HOUSING_INVALID_RESPONSE",
      retryable: true,
    });
  });

  it("normalizes provider errors without retaining secret text", async () => {
    const secret = "credential-do-not-expose-this-value-anywhere";
    const query = thenableResult({
      data: null,
      error: { message: `database failed with ${secret}` },
    });
    const adapter = new HistoricalHousingSupabaseAdapter({
      client: { rpc: vi.fn(() => query) } as unknown as SupabaseClient,
    });

    const failure = await adapter
      .search(input)
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({
      code: "HOUSING_QUERY_FAILED",
      retryable: true,
    });
    expect(JSON.stringify(failure)).not.toContain(secret);
  });

  it("aborts a slow RPC and reports a stable timeout", async () => {
    const query = hangingResult();
    const adapter = new HistoricalHousingSupabaseAdapter({
      client: { rpc: vi.fn(() => query) } as unknown as SupabaseClient,
      timeoutMs: 5,
    });

    await expect(adapter.search(input)).rejects.toMatchObject({
      code: "HOUSING_TIMEOUT",
      status: 504,
      retryable: true,
    });
    expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("distinguishes caller cancellation from a timeout", async () => {
    const query = hangingResult();
    const controller = new AbortController();
    const adapter = new HistoricalHousingSupabaseAdapter({
      client: { rpc: vi.fn(() => query) } as unknown as SupabaseClient,
      timeoutMs: 1_000,
    });

    const pending = adapter.search(input, controller.signal);
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toMatchObject({
      code: "HOUSING_ABORTED",
      retryable: false,
    });
  });
});
