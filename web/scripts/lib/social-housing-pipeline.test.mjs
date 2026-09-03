import { describe, expect, it } from "vitest";

import {
  buildKeywordMatrix,
  canonicalXiaohongshuUrl,
  dedupeCandidates,
  eligibilityFailureReasons,
  gcj02ToWgs84,
  mapWithConcurrency,
  normalizedLocationCacheKey,
  prefilterRentalPost,
  requireCompleteReviewDecisions,
  sanitizePublicText,
  selectRotatingKeywordBatch,
  selectPreferredDistrict,
  sourceIdentityKey,
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

  it("builds and rotates a district, community and station keyword matrix", () => {
    const keywords = buildKeywordMatrix({
      city: "杭州",
      intents: ["转租", "房东直租"],
      districts: [
        {
          district: "拱墅区",
          communities: ["武林广场"],
          stations: ["武林广场地铁站"],
        },
        {
          district: "西湖区",
          communities: ["古荡"],
          stations: ["文新地铁站"],
        },
      ],
    });

    expect(keywords).toContain("杭州拱墅区转租");
    expect(keywords).toContain("杭州武林广场房东直租");
    expect(keywords).toContain("杭州文新地铁站转租");
    expect(keywords).toHaveLength(12);
    expect(selectRotatingKeywordBatch(keywords, 10, 4)).toEqual([
      keywords[10],
      keywords[11],
      keywords[0],
      keywords[1],
    ]);
  });

  it("interleaves districts before advancing to another location", () => {
    expect(
      buildKeywordMatrix({
        city: "杭州",
        intents: ["转租", "直租"],
        districts: [
          { district: "上城区", communities: ["近江"], stations: ["城站"] },
          { district: "拱墅区", communities: ["大关"], stations: ["武林"] },
        ],
      }),
    ).toEqual([
      "杭州上城区转租",
      "杭州拱墅区转租",
      "杭州上城区直租",
      "杭州拱墅区直租",
      "杭州近江转租",
      "杭州大关转租",
      "杭州近江直租",
      "杭州大关直租",
      "杭州城站转租",
      "杭州武林转租",
      "杭州城站直租",
      "杭州武林直租",
    ]);
  });

  it("prefilters only obvious non-listings before model extraction", () => {
    expect(
      prefilterRentalPost({ title: "求租", desc: "预算 3000 求租一居室" }),
    ).toEqual({
      pass: false,
      reason: "wanted",
    });
    expect(
      prefilterRentalPost({ title: "租房攻略", desc: "杭州租房避坑经验分享" }),
    ).toEqual({
      pass: false,
      reason: "advice",
    });
    expect(
      prefilterRentalPost({ title: "已出租", desc: "房子已经租掉了" }),
    ).toEqual({
      pass: false,
      reason: "closed",
    });
    expect(
      prefilterRentalPost({
        title: "滨江转租",
        desc: "长河地铁站附近，一室户，租金可谈",
      }),
    ).toEqual({ pass: true, reason: null });
    expect(
      prefilterRentalPost({
        title: "滨江有一套房",
        desc: "价格 2500，长河附近",
      }),
    ).toEqual({ pass: true, reason: null });
  });

  it("keys source deduplication by platform and post id", () => {
    expect(sourceIdentityKey("xiaohongshu", "abc")).toBe("xiaohongshu:abc");
    expect(sourceIdentityKey("douyin", "abc")).toBe("douyin:abc");
  });

  it("normalizes one place into a reusable geocode cache key", () => {
    expect(
      normalizedLocationCacheKey({
        city: "杭州市",
        district: "拱墅区",
        community: "武林 广场小区",
        locationText: "武林广场",
      }),
    ).toBe("杭州|拱墅区|武林广场");
  });

  it("limits concurrent work without changing result order", async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapWithConcurrency([3, 1, 2, 4], 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, value));
      active -= 1;
      return value * 2;
    });

    expect(maximum).toBe(2);
    expect(result).toEqual([6, 2, 4, 8]);
  });
});
