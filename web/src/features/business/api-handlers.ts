import "server-only";

import { z } from "zod";

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
  SourcedEntity,
} from "@/features/business/domain";
import type { BusinessRepository } from "@/features/business/repository";
import {
  createRepositories,
  type RepositoryMode,
} from "@/features/repositories";
import { AppError, toPublicError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requestIdFor } from "@/lib/request-id";

export interface BusinessApiRuntime {
  business: BusinessRepository;
  mode: RepositoryMode;
}

export type BusinessApiRuntimeFactory = () => Promise<BusinessApiRuntime>;

type BusinessListKind = "houses" | "deals" | "products" | "community-posts";
type BusinessListHandler = (request: Request) => Promise<Response>;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(max).optional());

const optionalInteger = (max: number) =>
  z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (typeof normalized !== "string") return normalized;
    return /^\d+$/u.test(normalized) ? Number(normalized) : normalized;
  }, z.number().int().nonnegative().max(max).optional());

const optionalBoolean = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return normalized;
}, z.boolean().optional());

const optionalCursor = optionalText(120);
const optionalLimit = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized !== "string") return normalized;
  return /^\d+$/u.test(normalized) ? Number(normalized) : normalized;
}, z.number().int().min(1).max(24).optional());

const housesQuerySchema = z
  .object({
    city: optionalText(40),
    district: optionalText(40),
    minPrice: optionalInteger(1_000_000),
    maxPrice: optionalInteger(1_000_000),
    roomType: optionalText(40),
    petsAllowed: optionalBoolean,
    sort: z.preprocess(
      emptyToUndefined,
      z.enum(["recommended", "price_asc", "price_desc"]).optional(),
    ),
    cursor: optionalCursor,
    limit: optionalLimit,
  })
  .strict()
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { path: ["maxPrice"], message: "最高租金不能低于最低租金" },
  );

const optionalNumber = (max: number) =>
  z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (typeof normalized !== "string") return normalized;
    return /^\d+(?:\.\d+)?$/u.test(normalized)
      ? Number(normalized)
      : normalized;
  }, z.number().finite().nonnegative().max(max).optional());

const dealsQuerySchema = z
  .object({
    query: optionalText(120),
    category: optionalText(80),
    maxPrice: optionalNumber(1_000_000),
    refundableOnly: optionalBoolean,
    cursor: optionalCursor,
    limit: optionalLimit,
  })
  .strict();

const productsQuerySchema = z
  .object({
    query: optionalText(120),
    category: optionalText(80),
    storeId: optionalText(120),
    maxPrice: optionalNumber(1_000_000),
    inStockOnly: optionalBoolean,
    cursor: optionalCursor,
    limit: optionalLimit,
  })
  .strict();

const communityPostsQuerySchema = z
  .object({
    query: optionalText(120),
    category: optionalText(80),
    cursor: optionalCursor,
    limit: optionalLimit,
  })
  .strict();

function queryRecord(searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of searchParams) {
    const existing = result[key];
    result[key] = existing === undefined ? value : [existing, value];
  }
  return result;
}

function parseQuery<T>(schema: z.ZodType<T>, request: Request): T {
  const result = schema.safeParse(
    queryRecord(new URL(request.url).searchParams),
  );
  if (!result.success) {
    throw new AppError({
      code: "BUSINESS_QUERY_INVALID",
      message: "业务查询参数格式无效",
      status: 400,
      cause: result.error,
    });
  }
  return result.data;
}

function publicSource(
  kind: BusinessListKind,
  mode: RepositoryMode,
  items: readonly SourcedEntity[],
) {
  const returnedDemoItems =
    items.length > 0 && items.every((item) => item.isDemo);
  const isDemo =
    mode.mode !== "supabase" || kind !== "houses" || returnedDemoItems;
  if (isDemo) {
    return {
      source: "supabase_mock" as const,
      label:
        mode.mode === "demo_fallback"
          ? "演示业务数据（Supabase 回退）"
          : "演示业务数据",
      isDemo: true,
      mode: mode.mode,
    };
  }
  return {
    source: "housing_history_2024" as const,
    label: "2024 历史房源数据",
    isDemo: false,
    mode: mode.mode,
  };
}

function successResponse<T extends SourcedEntity>(
  page: Page<T>,
  kind: BusinessListKind,
  mode: RepositoryMode,
  requestId: string,
): Response {
  return Response.json(
    {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor,
      source: publicSource(kind, mode, page.items),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

function errorResponse(error: unknown, requestId: string): Response {
  const normalized = toPublicError(error, requestId);
  logger.warn("business_api.failed", {
    requestId,
    errorCode: normalized.code,
  });
  return Response.json(
    { error: normalized },
    {
      status: error instanceof AppError ? error.status : 500,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

async function defaultRuntime(): Promise<BusinessApiRuntime> {
  const { business, mode } = await createRepositories();
  return { business, mode };
}

function createListHandler<TFilter, TEntity extends SourcedEntity>(options: {
  kind: BusinessListKind;
  schema: z.ZodType<TFilter>;
  runtimeFactory: BusinessApiRuntimeFactory;
  list(repository: BusinessRepository, filter: TFilter): Promise<Page<TEntity>>;
}): BusinessListHandler {
  return async (request) => {
    const requestId = requestIdFor(request);
    try {
      const filter = parseQuery(options.schema, request);
      const runtime = await options.runtimeFactory();
      const page = await options.list(runtime.business, filter);
      return successResponse(page, options.kind, runtime.mode, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export function createHousesHandler(
  runtimeFactory: BusinessApiRuntimeFactory = defaultRuntime,
): BusinessListHandler {
  return createListHandler<HouseFilter, House>({
    kind: "houses",
    schema: housesQuerySchema,
    runtimeFactory,
    list: (repository, filter) => repository.listHouses(filter),
  });
}

export function createDealsHandler(
  runtimeFactory: BusinessApiRuntimeFactory = defaultRuntime,
): BusinessListHandler {
  return createListHandler<DealFilter, Deal>({
    kind: "deals",
    schema: dealsQuerySchema,
    runtimeFactory,
    list: (repository, filter: DealFilter) => repository.listDeals(filter),
  });
}

export function createProductsHandler(
  runtimeFactory: BusinessApiRuntimeFactory = defaultRuntime,
): BusinessListHandler {
  return createListHandler<ProductFilter, Product>({
    kind: "products",
    schema: productsQuerySchema,
    runtimeFactory,
    list: (repository, filter: ProductFilter) =>
      repository.listProducts(filter),
  });
}

export function createCommunityPostsHandler(
  runtimeFactory: BusinessApiRuntimeFactory = defaultRuntime,
): BusinessListHandler {
  return createListHandler<CommunityPostFilter, CommunityPost>({
    kind: "community-posts",
    schema: communityPostsQuerySchema,
    runtimeFactory,
    list: (repository, filter: CommunityPostFilter) =>
      repository.listCommunityPosts(filter),
  });
}
