import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SocialHousingLeadDetail } from "@/components/business/house-detail";
import type { SocialHousingLeadDetail as SocialHousingLeadDetailData } from "@/features/social-housing/types";

const lead: SocialHousingLeadDetailData = {
  id: "30000000-0000-4000-8000-000000000001",
  title: "萧山区一居室个人转租",
  summary: "近地铁的一居室转租线索。",
  community: "建设三路附近",
  address: null,
  district: "萧山区",
  monthlyRentMin: 950,
  monthlyRentMax: 1_200,
  rentType: "整租",
  layout: "1室1厅",
  areaSqm: null,
  location: { longitude: 120.2468, latitude: 30.1862 },
  coordinateSystem: "wgs84",
  publishedAt: "2026-06-26T08:00:00.000Z",
  lastSeenAt: "2026-09-03T02:19:00.000Z",
  sourcePlatforms: ["xiaohongshu", "douyin"],
  sourceCount: 2,
  verificationLabel: "房态未经核验",
  sourceLabel: "近期社交平台租房线索",
  disclaimer: "来自公开帖子并经字段清洗，房态、身份和价格均未经核验",
  sources: [
    {
      platform: "xiaohongshu",
      canonicalUrl:
        "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b",
      sourcePublishedAt: "2026-06-26T08:00:00.000Z",
      lastCheckedAt: "2026-09-03T02:19:00.000Z",
      sourceStatus: "not_obviously_closed",
    },
    {
      platform: "douyin",
      canonicalUrl: "https://www.douyin.com/video/7512345678901234567",
      sourcePublishedAt: "2026-06-27T08:00:00.000Z",
      lastCheckedAt: "2026-09-03T02:19:00.000Z",
      sourceStatus: "unknown",
    },
  ],
};

describe("SocialHousingLeadDetail", () => {
  it("shows every canonical source without presenting the lead as verified inventory", () => {
    render(<SocialHousingLeadDetail lead={lead} />);

    expect(screen.getByText("房态未经核验")).toBeInTheDocument();
    expect(screen.getByText("¥950–1200/月")).toBeInTheDocument();
    expect(screen.getByText(/不代表当前可租/)).toBeInTheDocument();
    const xhs = screen.getByRole("link", { name: /查看小红书原帖/ });
    const douyin = screen.getByRole("link", { name: /查看抖音原帖/ });
    expect(xhs).toHaveAttribute(
      "href",
      "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b",
    );
    expect(douyin).toHaveAttribute(
      "href",
      "https://www.douyin.com/video/7512345678901234567",
    );
    expect(
      screen.queryByRole("button", { name: "预约演示" }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("xsec_token");
  });
});
