import type { ResultCard } from "@/features/agent/chat-events";
import type { ToolInputs, ToolName } from "@/features/agent/tools/schemas";
import {
  toolContractDefinitions,
  toolInputSchemas,
} from "@/features/agent/tools/schemas";
import type {
  ErasedToolDefinition,
  ToolContext,
  ToolDefinition,
  ToolResult,
  ToolSource,
} from "@/features/agent/tools/types";
import type { Deal, House, Product } from "@/features/business/domain";
import type { HistoricalHousingItem } from "@/features/housing/types";

function contract(name: ToolName) {
  return toolContractDefinitions.find(
    (definition) => definition.name === name,
  )!;
}

function businessSource(
  context: ToolContext,
  items?: readonly { isDemo: boolean }[],
): ToolSource {
  if (items?.length && items.every((item) => item.isDemo))
    return "supabase_mock";
  return context.businessSource;
}

function houseView(house: House): Record<string, unknown> {
  return {
    id: house.id,
    name: house.name,
    city: house.city,
    district: house.district,
    address: house.address,
    priceMonthly: house.priceMonthly,
    roomType: house.roomType,
    areaSqm: house.areaSqm,
    petsAllowed: house.petsAllowed,
    available: house.available,
    subwayDistanceM: house.subwayDistanceM,
    tags: house.tags,
    historicalYear: house.historicalYear,
    location: house.location,
    isDemo: house.isDemo,
  };
}

function historicalHouseView(
  house: HistoricalHousingItem,
): Record<string, unknown> {
  return {
    id: house.id,
    name: house.title,
    city: "杭州",
    district: house.district,
    address: house.address,
    priceMonthly: house.monthlyRent,
    roomType: house.layout,
    areaSqm: house.areaSqm,
    petsAllowed: null,
    petsPolicy: house.petsPolicy,
    available: null,
    subwayDistanceM: null,
    distanceM: house.distanceM,
    tags: [house.rentType, house.orientation, house.floor].filter(Boolean),
    historicalYear: 2024,
    datasetPeriod: house.datasetPeriod,
    location: house.location,
    isDemo: false,
    detailAvailable: false,
    sourceUrl: house.sourceUrl,
  };
}

function normalizedCenterName(value: string): string {
  return value.trim().replace(/(?:附近|周边)$/u, "").trim();
}

function historicalLayout(roomType: string | null): string | null {
  if (roomType === "一居室") return "1室";
  if (roomType === "两居室") return "2室";
  if (roomType === "开间") return "1室0厅";
  if (roomType === "整租" || roomType === "合租") return null;
  return roomType;
}

function historicalRentType(
  roomType: string | null,
): "整租" | "合租" | null {
  if (roomType === "整租" || roomType === "合租") return roomType;
  return null;
}

function dealView(deal: Deal): Record<string, unknown> {
  return {
    id: deal.id,
    title: deal.title,
    merchantName: deal.merchantName,
    category: deal.category,
    originalPrice: deal.originalPrice,
    salePrice: deal.salePrice,
    refundable: deal.refundable,
    refundPolicyLabel: deal.refundPolicyLabel,
    validUntil: deal.validUntil,
    address: deal.address,
    tags: deal.tags,
    isDemo: deal.isDemo,
  };
}

function productSearchView(product: Product): Record<string, unknown> {
  return {
    id: product.id,
    storeId: product.storeId,
    name: product.name,
    category: product.category,
    price: product.price,
    tags: product.tags,
    inStock: product.availableStock > 0,
    isDemo: product.isDemo,
  };
}

function cards(
  kind: ResultCard["kind"],
  items: readonly Record<string, unknown>[],
): ResultCard[] {
  return items.map((data) => ({ kind, data }));
}

function failure<T>(
  source: ToolSource,
  code: string,
  message: string,
): ToolResult<T> {
  return {
    ok: false,
    error: { code, message, retryable: false },
    source,
    resultCount: 0,
  };
}

const searchHouses: ToolDefinition<ToolInputs["search_houses"]> = {
  ...contract("search_houses"),
  publicLabel: "正在查询房源",
  source: (context, input) => {
    const requestedCenter = input?.near_location
      ? normalizedCenterName(input.near_location)
      : null;
    const configuredCenter = context.housing
      ? normalizedCenterName(context.housing.defaultCenter.label)
      : null;
    return context.housing?.mode === "http" &&
      requestedCenter !== null &&
      requestedCenter === configuredCenter
      ? "housing_history_2024"
      : context.businessSource;
  },
  inputSchema: toolInputSchemas.search_houses,
  async execute(input, context) {
    const housing = context.housing;
    if (housing?.mode === "http" && input.near_location !== null) {
      const requestedCenter = normalizedCenterName(input.near_location);
      const configuredCenter = normalizedCenterName(
        housing.defaultCenter.label,
      );
      if (requestedCenter !== configuredCenter) {
        return failure(
          "housing_history_2024",
          "HOUSING_LOCATION_NOT_GEOCODED",
          `本地历史房源当前只配置了${housing.defaultCenter.label}坐标；接入高德后才能查询其他地点`,
        );
      }
      if (input.city !== "杭州") {
        return failure(
          "housing_history_2024",
          "HOUSING_UNSUPPORTED_CITY",
          "当前历史房源数据仅覆盖杭州",
        );
      }
      if (input.pets_allowed !== null) {
        return failure(
          "housing_history_2024",
          "HOUSING_PET_FILTER_UNAVAILABLE",
          "2024 历史房源没有可靠的宠物政策字段，不能按是否允许宠物筛选",
        );
      }
      if (!housing.service) {
        return failure(
          "housing_history_2024",
          "HOUSING_NOT_CONFIGURED",
          "历史房源服务尚未完成配置",
        );
      }
      const result = await housing.service.search(
        {
          city: input.city,
          center: housing.defaultCenter,
          radiusM: housing.radiusM,
          filters: {
            minPrice: input.min_price,
            maxPrice: input.max_price,
            rentType: historicalRentType(input.room_type),
            layout: historicalLayout(input.room_type),
            minArea: null,
            maxArea: null,
            district: input.district,
          },
          sort: "distance",
          limit: input.limit,
        },
        context.signal,
      );
      const items = result.items.map(historicalHouseView);
      return {
        ok: true,
        data: {
          items,
          total: items.length,
          historicalYear: 2024,
          datasetPeriod: result.datasetPeriod,
          centerLabel: housing.defaultCenter.label,
          radiusM: housing.radiusM,
          isHistorical: result.isHistorical,
          isRealtime: result.isRealtime,
          disclaimer: result.disclaimer,
          sourceLabel: result.sourceLabel,
          upstreamRequestId: result.requestId,
          source: "housing_history_2024",
        },
        source: "housing_history_2024",
        cards: cards("house", items),
        resultCount: items.length,
      };
    }
    const page = await context.business.listHouses({
      city: input.city,
      ...(input.district !== null && { district: input.district }),
      ...(input.min_price !== null && { minPrice: input.min_price }),
      ...(input.max_price !== null && { maxPrice: input.max_price }),
      ...(input.room_type !== null && { roomType: input.room_type }),
      ...(input.pets_allowed !== null && {
        petsAllowed: input.pets_allowed,
      }),
      limit: input.limit,
    });
    const source = businessSource(context, page.items);
    const items = page.items.map(houseView);
    return {
      ok: true,
      data: {
        items,
        total: page.total,
        historicalYear: 2024,
        ...(input.near_location !== null && {
          nearLocationPending: input.near_location,
        }),
        source,
      },
      source,
      cards: cards("house", items),
      resultCount: items.length,
    };
  },
};

const getHouseDetail: ToolDefinition<ToolInputs["get_house_detail"]> = {
  ...contract("get_house_detail"),
  publicLabel: "正在读取房源详情",
  source: (context) => context.businessSource,
  inputSchema: toolInputSchemas.get_house_detail,
  async execute(input, context) {
    const house = await context.business.getHouse(input.house_id);
    const source = businessSource(context, house ? [house] : undefined);
    if (!house) return failure(source, "HOUSE_NOT_FOUND", "没有找到该房源记录");
    const data = houseView(house);
    return {
      ok: true,
      data,
      source,
      cards: cards("house", [data]),
      resultCount: 1,
    };
  },
};

const searchDeals: ToolDefinition<ToolInputs["search_deals"]> = {
  ...contract("search_deals"),
  publicLabel: "正在查询团购",
  source: () => "supabase_mock",
  inputSchema: toolInputSchemas.search_deals,
  async execute(input, context) {
    const page = await context.business.listDeals({
      ...(input.query !== null && { query: input.query }),
      ...(input.category !== null && { category: input.category }),
      ...(input.max_price !== null && { maxPrice: input.max_price }),
      ...(input.refundable_only !== null && {
        refundableOnly: input.refundable_only,
      }),
      limit: input.limit,
    });
    const items = page.items.map(dealView);
    return {
      ok: true,
      data: { items, total: page.total, source: "supabase_mock" },
      source: "supabase_mock",
      cards: cards("deal", items),
      resultCount: items.length,
    };
  },
};

const searchProducts: ToolDefinition<ToolInputs["search_products"]> = {
  ...contract("search_products"),
  publicLabel: "正在查询商品",
  source: () => "supabase_mock",
  inputSchema: toolInputSchemas.search_products,
  async execute(input, context) {
    const page = await context.business.listProducts({
      ...(input.query !== null && { query: input.query }),
      ...(input.category !== null && { category: input.category }),
      ...(input.store_id !== null && { storeId: input.store_id }),
      ...(input.max_price !== null && { maxPrice: input.max_price }),
      inStockOnly: input.in_stock_only,
      limit: input.limit,
    });
    const items = page.items.map(productSearchView);
    return {
      ok: true,
      data: { items, total: page.total, source: "supabase_mock" },
      source: "supabase_mock",
      cards: cards("product", items),
      resultCount: items.length,
    };
  },
};

const getProductStock: ToolDefinition<ToolInputs["get_product_stock"]> = {
  ...contract("get_product_stock"),
  publicLabel: "正在核对商品库存",
  source: () => "supabase_mock",
  inputSchema: toolInputSchemas.get_product_stock,
  async execute(input, context) {
    const product = await context.business.getProduct(input.product_id);
    if (!product)
      return failure(
        "supabase_mock",
        "PRODUCT_NOT_FOUND",
        "没有找到该商品记录",
      );
    const data = {
      ...productSearchView(product),
      availableStock: product.availableStock,
    };
    return {
      ok: true,
      data,
      source: "supabase_mock",
      cards: cards("product", [data]),
      resultCount: 1,
    };
  },
};

export const businessToolDefinitions: readonly ErasedToolDefinition[] = [
  searchHouses,
  getHouseDetail,
  searchDeals,
  searchProducts,
  getProductStock,
] as unknown as readonly ErasedToolDefinition[];
