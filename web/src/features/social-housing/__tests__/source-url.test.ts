import { describe, expect, it } from "vitest";

import { canonicalizeSocialPostUrl } from "@/features/social-housing/source-url";

describe("canonicalizeSocialPostUrl", () => {
  it("removes Xiaohongshu access tokens and keeps only the public post id", () => {
    expect(
      canonicalizeSocialPostUrl(
        "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b?xsec_token=do-not-publish&xsec_source=pc_search",
      ),
    ).toEqual({
      platform: "xiaohongshu",
      platformPostId: "69bbc8f4000000002800bb6b",
      canonicalUrl:
        "https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b",
    });
  });

  it("normalizes Douyin video links", () => {
    expect(
      canonicalizeSocialPostUrl(
        "https://www.douyin.com/video/7512345678901234567?previous_page=web_code_link",
      ),
    ).toEqual({
      platform: "douyin",
      platformPostId: "7512345678901234567",
      canonicalUrl: "https://www.douyin.com/video/7512345678901234567",
    });
  });

  it("rejects unsupported hosts and non-post paths", () => {
    expect(() =>
      canonicalizeSocialPostUrl("https://example.com/explore/abc123"),
    ).toThrow(/unsupported/u);
    expect(() =>
      canonicalizeSocialPostUrl("https://www.xiaohongshu.com/search_result"),
    ).toThrow(/unsupported/u);
  });
});
