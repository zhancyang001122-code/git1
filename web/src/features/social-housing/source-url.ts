import { z } from "zod";

import type { SocialHousingPlatform } from "@/features/social-housing/types";

const inputSchema = z.string().url().max(2_048);
const xiaohongshuPostIdSchema = z.string().regex(/^[0-9a-f]{24}$/u);
const douyinPostIdSchema = z.string().regex(/^\d{15,25}$/u);

export interface CanonicalSocialPostUrl {
  platform: SocialHousingPlatform;
  platformPostId: string;
  canonicalUrl: string;
}

export function canonicalizeSocialPostUrl(
  input: string,
): CanonicalSocialPostUrl {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error("unsupported social post URL");
  const url = new URL(parsed.data);

  if (url.protocol !== "https:") {
    throw new Error("unsupported social post URL");
  }

  if (
    url.hostname === "www.xiaohongshu.com" ||
    url.hostname === "xiaohongshu.com"
  ) {
    const match = url.pathname.match(
      /^\/(?:explore|discovery\/item)\/([^/]+)\/?$/u,
    );
    const platformPostId = match?.[1];
    if (
      !platformPostId ||
      !xiaohongshuPostIdSchema.safeParse(platformPostId).success
    ) {
      throw new Error("unsupported social post URL");
    }
    return {
      platform: "xiaohongshu",
      platformPostId,
      canonicalUrl: `https://www.xiaohongshu.com/explore/${platformPostId}`,
    };
  }

  if (url.hostname === "www.douyin.com" || url.hostname === "douyin.com") {
    const match = url.pathname.match(/^\/video\/(\d+)\/?$/u);
    const platformPostId = match?.[1];
    if (
      !platformPostId ||
      !douyinPostIdSchema.safeParse(platformPostId).success
    ) {
      throw new Error("unsupported social post URL");
    }
    return {
      platform: "douyin",
      platformPostId,
      canonicalUrl: `https://www.douyin.com/video/${platformPostId}`,
    };
  }

  throw new Error("unsupported social post URL");
}
