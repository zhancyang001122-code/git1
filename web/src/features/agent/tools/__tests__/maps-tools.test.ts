import { describe, expect, it, vi } from "vitest";

import { createTaskSixToolRegistry } from "@/features/agent/tools/registry";
import { FakeMapsService } from "@/features/maps/fake-adapter";

import { createToolTestContext } from "./helpers";

describe("map tools", () => {
  it("registers the two strict AMap tools", () => {
    const definitions = createTaskSixToolRegistry().providerDefinitions();

    expect(definitions).toHaveLength(10);
    expect(definitions.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "search_nearby_places",
        "calculate_walking_route",
      ]),
    );
  });

  it("geocodes a named center before returning source-labelled place cards", async () => {
    const maps = new FakeMapsService();
    const geocode = vi.spyOn(maps, "geocode");
    const result = await createTaskSixToolRegistry()
      .get("search_nearby_places")
      .execute(
        {
          keyword: "超市",
          city: "杭州",
          center_name: "武林广场",
          longitude: null,
          latitude: null,
          radius_m: 1500,
          limit: 5,
        },
        createToolTestContext({ maps }),
      );

    expect(geocode).toHaveBeenCalledWith(
      { address: "武林广场", city: "杭州" },
      expect.any(AbortSignal),
    );
    expect(result).toMatchObject({ ok: true, source: "amap", resultCount: 1 });
    expect(result.cards?.[0]).toMatchObject({
      kind: "place",
      data: { source: "amap", isDemo: true },
    });
  });

  it("returns a stable no-result error instead of inventing a place", async () => {
    const result = await createTaskSixToolRegistry()
      .get("search_nearby_places")
      .execute(
        {
          keyword: "超市",
          city: "杭州",
          center_name: "不存在地点",
          longitude: null,
          latitude: null,
          radius_m: 1500,
          limit: 5,
        },
        createToolTestContext({ maps: new FakeMapsService() }),
      );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "AMAP_NO_RESULT", retryable: false },
      resultCount: 0,
    });
  });

  it("returns walking distance only from the maps service", async () => {
    const result = await createTaskSixToolRegistry()
      .get("calculate_walking_route")
      .execute(
        {
          origin_longitude: 120.163102,
          origin_latitude: 30.274085,
          destination_longitude: 120.16421,
          destination_latitude: 30.27331,
        },
        createToolTestContext({ maps: new FakeMapsService() }),
      );

    expect(result).toMatchObject({
      ok: true,
      source: "amap",
      resultCount: 1,
      data: { source: "amap", isDemo: true },
    });
  });
});
