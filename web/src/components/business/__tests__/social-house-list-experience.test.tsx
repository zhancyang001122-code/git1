import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SocialHouseListExperience } from "@/components/business/social-house-list-experience";
import { SelectedLocationProvider } from "@/features/location/selected-location-provider";

const selectedLocation = {
  name: "武林广场",
  city: "杭州",
  point: { longitude: 120.163102, latitude: 30.274085 },
  wgs84Point: { longitude: 120.1585, latitude: 30.2764 },
  source: "default" as const,
};

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("SocialHouseListExperience", () => {
  it("loads approved leads by selected-location distance with explicit provenance", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
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
              location: { longitude: 120.2468, latitude: 30.1862 },
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
          source: {
            source: "social_housing_leads",
            label: "近期社交平台租房线索",
            isVerified: false,
            mode: "supabase",
            disclaimer: "来自公开帖子并经字段清洗，房态、身份和价格均未经核验",
          },
          warnings: [],
        }),
      ),
    );

    render(
      <SelectedLocationProvider defaultLocation={selectedLocation}>
        <SocialHouseListExperience />
      </SelectedLocationProvider>,
    );

    expect(await screen.findByText("找到 1 条近期线索")).toBeInTheDocument();
    expect(screen.getByText("萧山区一居室个人转租")).toBeInTheDocument();
    expect(screen.getByText("房态未经核验")).toBeInTheDocument();
    expect(screen.getByText("¥950–1200/月")).toBeInTheDocument();
    expect(screen.getByText("小红书 · 1 个来源")).toBeInTheDocument();
    expect(screen.getByText("距您直线 1.2km")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("sort=distance_asc");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("longitude=120.1585");
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("xsec_token");
  });
});
