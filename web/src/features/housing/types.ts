export interface HousingSearchCenter {
  label: string;
  latitude: number;
  longitude: number;
}

export interface HousingSearchFilters {
  minPrice: number | null;
  maxPrice: number | null;
  rentType: "整租" | "合租" | null;
  layout: string | null;
  minArea: number | null;
  maxArea: number | null;
  district: string | null;
}

export interface HousingSearchInput {
  city: string;
  center: HousingSearchCenter;
  radiusM: number;
  filters: HousingSearchFilters;
  sort: "distance" | "price_asc" | "price_desc" | "area_desc";
  limit: number;
}

export interface HistoricalHousingItem {
  id: string;
  title: string | null;
  community: string | null;
  address: string | null;
  district: string | null;
  distanceM: number;
  monthlyRent: number;
  rentType: string | null;
  layout: string | null;
  areaSqm: number | null;
  orientation: string | null;
  floor: string | null;
  sourceUrl: string | null;
  location: { longitude: number; latitude: number };
  datasetPeriod: "2024-11";
}

export interface HistoricalHousingSearchResult {
  items: readonly HistoricalHousingItem[];
  sourceLabel: string;
  datasetPeriod: "2024-11";
  isHistorical: true;
  isRealtime: false;
  disclaimer: string;
  requestId: string;
  durationMs: number;
  warnings: readonly string[];
}

export interface HousingSearchService {
  search(
    input: HousingSearchInput,
    signal?: AbortSignal,
  ): Promise<HistoricalHousingSearchResult>;
}

export interface HousingRuntime {
  mode: "supabase" | "http" | "unavailable";
  service?: HousingSearchService;
  defaultCenter: HousingSearchCenter;
  radiusM: number;
}
