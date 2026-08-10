import {
  demoCommunityPosts,
  demoDeals,
  demoHouses,
  demoProducts,
  demoStores,
} from "@/features/business/demo-data";
import type {
  CommunityPost,
  Deal,
  House,
  Page,
  Product,
} from "@/features/business/domain";
import type { BusinessRepository } from "@/features/business/repository";

function includesText(values: readonly string[], query?: string): boolean {
  if (!query?.trim()) return true;
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  return values.some((value) =>
    value.toLocaleLowerCase("zh-CN").includes(normalized),
  );
}

function paginate<T extends { id: string }>(
  items: readonly T[],
  cursor?: string,
  limit?: number,
): Page<T> {
  const start = cursor
    ? Math.max(0, items.findIndex((item) => item.id === cursor) + 1)
    : 0;
  const pageSize = Math.max(1, Math.min(limit ?? items.length, 24));
  const pageItems = items.slice(start, start + pageSize);
  const hasMore = start + pageItems.length < items.length;

  return {
    items: pageItems,
    total: items.length,
    nextCursor: hasMore ? (pageItems.at(-1)?.id ?? null) : null,
  };
}

function byNumberThenId<T extends { id: string }>(
  value: (item: T) => number,
  direction: 1 | -1 = 1,
) {
  return (left: T, right: T) =>
    (value(left) - value(right)) * direction || left.id.localeCompare(right.id);
}

function findById<T extends { id: string }>(
  items: readonly T[],
  id: string,
): T | null {
  return items.find((item) => item.id === id) ?? null;
}

export function createDemoRepository(): BusinessRepository {
  return {
    async listHouses(filter) {
      let items: House[] = demoHouses.filter(
        (house) =>
          house.available &&
          (!filter.district || house.district === filter.district) &&
          (filter.maxPrice === undefined ||
            house.priceMonthly <= filter.maxPrice) &&
          (!filter.roomType || house.roomType === filter.roomType) &&
          (filter.petsAllowed === undefined ||
            house.petsAllowed === filter.petsAllowed),
      );

      if (filter.sort === "price_asc") {
        items = items.toSorted(byNumberThenId((house) => house.priceMonthly));
      } else if (filter.sort === "price_desc") {
        items = items.toSorted(
          byNumberThenId((house) => house.priceMonthly, -1),
        );
      }

      return paginate(items, filter.cursor, filter.limit);
    },

    async getHouse(id) {
      return findById(demoHouses, id);
    },

    async listDeals(filter) {
      const items: Deal[] = demoDeals
        .filter(
          (deal) =>
            includesText(
              [deal.title, deal.merchantName, deal.category, ...deal.tags],
              filter.query,
            ) &&
            (!filter.category || deal.category === filter.category) &&
            (filter.maxPrice === undefined ||
              deal.salePrice <= filter.maxPrice) &&
            (!filter.refundableOnly || deal.refundable),
        )
        .toSorted(byNumberThenId((deal) => deal.salePrice));
      return paginate(items, filter.cursor, filter.limit);
    },

    async getDeal(id) {
      return findById(demoDeals, id);
    },

    async listStores() {
      return demoStores;
    },

    async getStore(id) {
      return findById(demoStores, id);
    },

    async listProducts(filter) {
      const items: Product[] = demoProducts
        .filter(
          (product) =>
            includesText(
              [product.name, product.category, ...product.tags],
              filter.query,
            ) &&
            (!filter.category || product.category === filter.category) &&
            (!filter.storeId || product.storeId === filter.storeId) &&
            (filter.maxPrice === undefined ||
              product.price <= filter.maxPrice) &&
            (!filter.inStockOnly || product.availableStock > 0),
        )
        .toSorted(byNumberThenId((product) => product.price));
      return paginate(items, filter.cursor, filter.limit);
    },

    async getProduct(id) {
      return findById(demoProducts, id);
    },

    async listCommunityPosts(filter) {
      const items: CommunityPost[] = demoCommunityPosts.filter(
        (post) =>
          includesText(
            [post.title, post.excerpt, post.category, ...post.tags],
            filter.query,
          ) &&
          (!filter.category || post.category === filter.category),
      );
      return paginate(items, filter.cursor, filter.limit);
    },

    async getCommunityPost(id) {
      return findById(demoCommunityPosts, id);
    },
  };
}
