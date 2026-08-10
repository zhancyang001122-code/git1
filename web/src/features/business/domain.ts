export interface Page<T> {
  items: readonly T[];
  total: number;
  nextCursor: string | null;
}

export interface DemoEntity {
  id: string;
  isDemo: true;
}

export interface House extends DemoEntity {
  name: string;
  district: string;
  address: string;
  priceMonthly: number;
  roomType: string;
  areaSqm: number;
  petsAllowed: boolean;
  available: boolean;
  subwayDistanceM: number;
  description: string;
  imageSrc: string;
  tags: readonly string[];
  historicalYear: 2024;
}

export interface Deal extends DemoEntity {
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
}

export interface Store extends DemoEntity {
  name: string;
  category: "supermarket" | "restaurant" | "cafe";
  district: string;
  address: string;
  deliveryMinutes: number | null;
  minimumOrder: number;
  imageSrc: string;
}

export interface Product extends DemoEntity {
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

export interface CommunityPost extends DemoEntity {
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
  district?: string;
  maxPrice?: number;
  roomType?: string;
  petsAllowed?: boolean;
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
