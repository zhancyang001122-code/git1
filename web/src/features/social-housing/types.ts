import type {
  HousingSearchCenter,
  HousingSearchFilters,
} from "@/features/housing/types";

export type SocialHousingPlatform = "xiaohongshu" | "douyin";

export interface SocialHousingSearchInput {
  city: string;
  center: HousingSearchCenter;
  radiusM: number | null;
  filters: HousingSearchFilters;
  sort: "distance" | "price_asc" | "price_desc" | "published_desc";
  offset?: number;
  limit: number;
}

export interface SocialHousingLeadItem {
  id: string;
  title: string;
  summary: string;
  community: string | null;
  address: string | null;
  district: string | null;
  distanceM: number;
  monthlyRentMin: number;
  monthlyRentMax: number | null;
  rentType: string | null;
  layout: string | null;
  areaSqm: number | null;
  location: { longitude: number; latitude: number };
  coordinateSystem: "wgs84";
  publishedAt: string;
  lastSeenAt: string;
  sourcePlatforms: readonly SocialHousingPlatform[];
  sourceCount: number;
  verificationLabel: "房态未经核验";
}

export interface SocialHousingLeadSource {
  platform: SocialHousingPlatform;
  canonicalUrl: string;
  sourcePublishedAt: string;
  lastCheckedAt: string;
  sourceStatus: "not_obviously_closed" | "closed" | "unknown";
}

export interface SocialHousingLeadDetail extends Omit<
  SocialHousingLeadItem,
  "distanceM"
> {
  sources: readonly SocialHousingLeadSource[];
  sourceLabel: string;
  disclaimer: string;
}

export interface SocialHousingSearchResult {
  items: readonly SocialHousingLeadItem[];
  total: number;
  nextCursor: string | null;
  sourceLabel: string;
  disclaimer: string;
  requestId: string;
  durationMs: number;
  warnings: readonly string[];
}

export interface SocialHousingSearchService {
  search(
    input: SocialHousingSearchInput,
    signal?: AbortSignal,
  ): Promise<SocialHousingSearchResult>;
  getById?(
    id: string,
    signal?: AbortSignal,
  ): Promise<SocialHousingLeadDetail | null>;
}

export interface SocialHousingRuntime {
  mode: "supabase" | "unavailable";
  service?: SocialHousingSearchService;
  defaultCenter: HousingSearchCenter;
}
