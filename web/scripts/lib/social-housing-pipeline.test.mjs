import { describe, expect, it } from "vitest";

import {
  canonicalXiaohongshuUrl,
  dedupeCandidates,
  eligibilityFailureReasons,
  gcj02ToWgs84,
  requireCompleteReviewDecisions,
  sanitizePublicText,
  selectPreferredDistrict,
} from "./social-housing-pipeline.mjs";

describe("social housing ingestion helpers", () => {
  it("removes contacts and tracking tokens from material kept after ingestion", () => {
    expect(
      sanitizePublicText("杭州转租，电话 13812345678，微信: rent_me"),
    ).toBe("杭州转租，电话 [联系方式已隐藏]，[联系方式已隐藏]");
    expect(canonicalXiaohongshuUrl("69bbc8f4000000002800bb6b")).toBe(
      "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b",
    );
  });

  it("deduplicates the same normalized listing and keeps the higher confidence one", () => {
    const base = {
      platform: "xiaohongshu",
      city: "杭州市",
      district: "萧山区",
      community: "建设三路",
      locationText: "建设三路",
      priceMinMonthly: 1500,
      priceMaxMonthly: 1800,
      layout: "1室1厅",
    };
    const result = dedupeCandidates([
      { ...base, sourceId: "a", confidence: 0.72 },
      { ...base, sourceId: "b", confidence: 0.91 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("b");
  });

  it("converts AMap GCJ-02 coordinates before distance calculations", () => {
    const result = gcj02ToWgs84(120.1551, 30.2741);
    expect(result.longitude).toBeCloseTo(120.1504, 2);
    expect(result.latitude).toBeCloseTo(30.2763, 2);
  });

  it("keeps extraction confidence advisory instead of using it as a hard gate", () => {
    expect(
      eligibilityFailureReasons(
        {
          category: "offering",
          explicitlyClosed: false,
          availabilityDeadline: null,
          priceMinMonthly: 1_500,
          priceMaxMonthly: 1_800,
          locationText: "彭埠地铁站",
          confidence: 0.2,
        },
        new Date("2026-09-03T02:30:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("blocks an import until every pending candidate has one decision", () => {
    expect(() =>
      requireCompleteReviewDecisions(
        [
          { sourceId: "a", reviewStatus: "pending_review" },
          { sourceId: "b", reviewStatus: "pending_review" },
        ],
        [{ sourceId: "a", decision: "approved" }],
      ),
    ).toThrow(/Missing decisions: b/u);
  });

  it("prefers a POI in the district extracted from the post", () => {
    expect(
      selectPreferredDistrict(
        [
          { name: "同名地点", district: "萧山区" },
          { name: "目标小区", district: "西湖区" },
        ],
        "西湖区",
      ),
    ).toEqual({ name: "目标小区", district: "西湖区" });
  });
});
