import type {
  CommunityPost,
  CommunityPostFilter,
  Deal,
  DealFilter,
  House,
  HouseFilter,
  Page,
  Product,
  ProductFilter,
  Store,
} from "@/features/business/domain";

export interface BusinessRepository {
  listHouses(filter: HouseFilter): Promise<Page<House>>;
  getHouse(id: string): Promise<House | null>;
  listDeals(filter: DealFilter): Promise<Page<Deal>>;
  getDeal(id: string): Promise<Deal | null>;
  listStores(): Promise<readonly Store[]>;
  getStore(id: string): Promise<Store | null>;
  listProducts(filter: ProductFilter): Promise<Page<Product>>;
  getProduct(id: string): Promise<Product | null>;
  listCommunityPosts(filter: CommunityPostFilter): Promise<Page<CommunityPost>>;
  getCommunityPost(id: string): Promise<CommunityPost | null>;
}
