export interface Page<T> {
  items: readonly T[];
  total: number;
  nextCursor: string | null;
}

export interface SourcedEntity {
  id: string;
  isDemo: boolean;
}

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface House extends SourcedEntity {
  name: string;
  city: string;
  district: string;
  address: string;
  priceMonthly: number;
  roomType: string;
  areaSqm: number;
  available: boolean;
  subwayDistanceM: number;
  description: string;
  imageSrc: string;
  tags: readonly string[];
  historicalYear: 2024;
  location: GeoPoint;
}

export interface Deal extends SourcedEntity {
  storeId: string | null;
  title: string;
  merchantName: string;
  category: string;
  originalPrice: number;
  salePrice: number;
  refundable: boolean;
  refundPolicyLabel: string;
  validUntil: string;
  address: string;
  description: string;
  imageSrc: string;
  tags: readonly string[];
  salesCount: number;
  location: GeoPoint;
}

export interface Store extends SourcedEntity {
  name: string;
  city: string;
  category: "supermarket" | "restaurant" | "cafe";
  district: string;
  address: string;
  deliveryMinutes: number | null;
  minimumOrder: number;
  imageSrc: string;
  location: GeoPoint;
}

export interface Product extends SourcedEntity {
  storeId: string;
  name: string;
  category: string;
  price: number;
  description: string;
  imageSrc: string;
  tags: readonly string[];
  stock: number;
  reserved: number;
  availableStock: number;
}

export interface CommunityPost extends SourcedEntity {
  category: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  locationLabel: string;
  coverImageSrc: string;
  tags: readonly string[];
  likeCount: number;
  commentCount: number;
}

export type HouseSort = "recommended" | "price_asc" | "price_desc";

export interface HouseFilter {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  roomType?: string;
  sort?: HouseSort;
  cursor?: string;
  limit?: number;
}

export interface DealFilter {
  query?: string;
  category?: string;
  maxPrice?: number;
  refundableOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export interface ProductFilter {
  query?: string;
  category?: string;
  storeId?: string;
  maxPrice?: number;
  inStockOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export interface CommunityPostFilter {
  query?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}
