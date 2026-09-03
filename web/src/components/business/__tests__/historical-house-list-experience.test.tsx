import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HistoricalHouseListExperience } from "@/components/business/historical-house-list-experience";
import { SelectedLocationProvider } from "@/features/location/selected-location-provider";

const selectedLocation = {
  name: "武林广场",
  city: "杭州",
  point: { longitude: 120.163102, latitude: 30.274085 },
  wgs84Point: { longitude: 120.1585, latitude: 30.2764 },
  source: "default" as const,
};

function item(id: string, name: string, distanceM: number) {
  return {
    id,
    title: name,
    community: "武林小区",
    address: "体育场路",
    district: "拱墅区",
    distanceM,
    monthlyRent: 3_800,
    rentType: "整租",
    layout: "2室1厅",
    areaSqm: 62,
    orientation: "南",
    floor: "中层",
    sourceUrl: "https://example.com/house",
    location: { longitude: 120.1552, latitude: 30.2742 },
    datasetPeriod: "2024-11",
  };
}

function response(items: ReturnType<typeof item>[], nextCursor: string | null) {
  return new Response(
    JSON.stringify({
      items,
      total: 60_202,
      nextCursor,
      source: {
        source: "housing_history_2024",
        label: "2024年11月杭州租房历史快照",
        isDemo: false,
        mode: "supabase",
        datasetPeriod: "2024-11",
        disclaimer: "仅供历史房源参考，不代表当前仍可出租或当前价格",
      },
      warnings: [],
    }),
  );
}

function renderList() {
  return render(
    <SelectedLocationProvider defaultLocation={selectedLocation}>
      <HistoricalHouseListExperience />
    </SelectedLocationProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("HistoricalHouseListExperience", () => {
  it("loads the full historical source by selected-location distance and paginates", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        response(
          [item("20000000-0000-4000-8000-000000000001", "第一套历史房源", 128)],
          "offset:1",
        ),
      )
      .mockResolvedValueOnce(
        response(
          [
            item(
              "20000000-0000-4000-8000-000000000002",
              "第二套历史房源",
              12_800,
            ),
          ],
          "offset:2",
        ),
      );

    renderList();

    expect(
      await screen.findByText("找到 60,202 条历史记录"),
    ).toBeInTheDocument();
    expect(screen.getByText("第一套历史房源")).toBeInTheDocument();
    expect(screen.getByText("距您直线 128m")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("sort=distance_asc");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("longitude=120.1585");
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("radius");

    await userEvent.click(screen.getByRole("button", { name: /加载更多/ }));

    expect(await screen.findByText("第二套历史房源")).toBeInTheDocument();
    expect(screen.getByText("距您直线 >10km")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toContain("cursor=offset%3A1");
  });

  it("does not silently return Hangzhou data for a Shaoxing location", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <SelectedLocationProvider
        defaultLocation={{
          ...selectedLocation,
          city: "绍兴",
          name: "鲁迅故里",
          source: "manual",
        }}
      >
        <HistoricalHouseListExperience />
      </SelectedLocationProvider>,
    );

    expect(screen.getByText(/历史房源目前只覆盖杭州/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
