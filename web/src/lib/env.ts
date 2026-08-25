import { z } from "zod";

export type EnvironmentInput = Record<string, string | undefined>;

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);

const optionalDashscopeRerankUrl = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.username === "" &&
        url.password === "" &&
        /^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/i.test(url.hostname) &&
        url.pathname.replace(/\/$/, "") === "/compatible-api/v1" &&
        url.search === "" &&
        url.hash === ""
      );
    }, "必须使用百炼北京工作空间专属 HTTPS compatible-api/v1 地址")
    .optional(),
);

function derivedDashscopeRerankBaseUrl(
  chatBaseUrl: string | undefined,
): string | undefined {
  if (!chatBaseUrl) return undefined;
  const url = new URL(chatBaseUrl);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    !/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/i.test(url.hostname) ||
    url.pathname.replace(/\/$/, "") !== "/compatible-mode/v1" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return undefined;
  }
  url.pathname = "/compatible-api/v1";
  return url.href.replace(/\/$/, "");
}

const optionalEmail = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase())
    .optional(),
);

const stringBoolean = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean().default(defaultValue));

const integerFromString = (
  defaultValue: number,
  minimum: number,
  maximum: number,
) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") return defaultValue;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return value;
  }, z.number().int().min(minimum).max(maximum));

const numberFromString = (
  defaultValue: number,
  minimum: number,
  maximum: number,
) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") return defaultValue;
    if (typeof value === "string" && value.trim() !== "") return Number(value);
    return value;
  }, z.number().finite().min(minimum).max(maximum));

const pricingTierSchema = z
  .object({
    maxInputTokens: z.number().int().positive().max(2_000_000),
    inputCnyPerMillion: z.number().finite().nonnegative().max(10_000),
    outputCnyPerMillion: z.number().finite().nonnegative().max(10_000),
  })
  .strict();

const optionalPricingTiers = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(pricingTierSchema).min(1).max(10).optional());

function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false;
  const hostname = new URL(value).hostname;
  return new Set(["127.0.0.1", "localhost", "::1"]).has(hostname);
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("小智"),
  NEXT_PUBLIC_APP_DESCRIPTION: z
    .string()
    .min(1)
    .default("本地生活 AI 服务助手"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  NEXT_PUBLIC_ENABLE_AI_DEBUG: stringBoolean(false),
  NEXT_PUBLIC_DEMO_MODE: stringBoolean(true),
  NEXT_PUBLIC_DEFAULT_CITY: z.string().min(1).default("杭州"),
  NEXT_PUBLIC_DEFAULT_LOCATION_NAME: z.string().min(1).default("武林广场"),
  NEXT_PUBLIC_DEFAULT_LONGITUDE: numberFromString(120.163102, -180, 180),
  NEXT_PUBLIC_DEFAULT_LATITUDE: numberFromString(30.274085, -90, 90),
});

const serverEnvSchema = z
  .object({
    SUPABASE_URL: optionalUrl,
    SUPABASE_SECRET_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    SUPABASE_FALLBACK_TO_DEMO: stringBoolean(false),
    DEMO_AUTH_EMAIL: optionalEmail,
    DEMO_AUTH_PASSWORD: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).optional(),
    ),
    ANONYMOUS_COOKIE_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).optional(),
    ),
    DASHSCOPE_API_KEY: optionalString,
    DASHSCOPE_MODEL: z.string().min(1).default("qwen-plus"),
    DASHSCOPE_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-v4"),
    DASHSCOPE_EMBEDDING_DIMENSIONS: integerFromString(1024, 1024, 1024),
    DASHSCOPE_RERANK_MODEL: z.string().min(1).default("qwen3-rerank"),
    DASHSCOPE_RERANK_BASE_URL: optionalDashscopeRerankUrl,
    DASHSCOPE_PRICING_MODEL: optionalString,
    DASHSCOPE_PRICING_MODE_LABEL: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).max(40).optional(),
    ),
    DASHSCOPE_PRICING_EFFECTIVE_FROM: z.preprocess(
      emptyStringToUndefined,
      z.string().date().optional(),
    ),
    DASHSCOPE_PRICING_SOURCE_URL: optionalUrl,
    DASHSCOPE_PRICING_TIERS_JSON: optionalPricingTiers,
    RAG_RERANK_ENABLED: stringBoolean(false),
    RAG_VECTOR_WEIGHT: numberFromString(0.65, 0, 1),
    RAG_TEXT_WEIGHT: numberFromString(0.35, 0, 1),
    RAG_LOW_CONFIDENCE_THRESHOLD: numberFromString(0.45, 0, 1),
    RAG_TOP_K: integerFromString(12, 1, 20),
    RAG_FINAL_K: integerFromString(5, 1, 10),
    DEMO_ADMIN_TOKEN: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).optional(),
    ),
    CRON_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).optional(),
    ),
    AI_REQUEST_TIMEOUT_MS: integerFromString(55_000, 1_000, 120_000),
    TOOL_TIMEOUT_MS: integerFromString(8_000, 100, 30_000),
    AI_MAX_TOOL_ROUNDS: integerFromString(8, 1, 8),
    AMAP_WEB_SERVICE_KEY: optionalString,
    HOUSING_API_BASE_URL: optionalUrl,
    HOUSING_API_KEY: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).optional(),
    ),
    HOUSING_HTTP_FALLBACK_ENABLED: stringBoolean(false),
    HOUSING_API_TIMEOUT_MS: integerFromString(8_000, 100, 30_000),
    HOUSING_DEFAULT_CENTER_NAME: z.string().min(1).default("武林广场"),
    HOUSING_DEFAULT_LONGITUDE: numberFromString(120.1551, -180, 180),
    HOUSING_DEFAULT_LATITUDE: numberFromString(30.2741, -90, 90),
    HOUSING_DEFAULT_RADIUS_M: integerFromString(2_000, 100, 5_000),
    DASHSCOPE_BASE_URL: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .url()
        .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
    ),
    AMAP_BASE_URL: z.preprocess(
      emptyStringToUndefined,
      z.string().url().default("https://restapi.amap.com"),
    ),
  })
  .superRefine((value, context) => {
    const pricingValues = [
      value.DASHSCOPE_PRICING_MODEL,
      value.DASHSCOPE_PRICING_MODE_LABEL,
      value.DASHSCOPE_PRICING_EFFECTIVE_FROM,
      value.DASHSCOPE_PRICING_SOURCE_URL,
      value.DASHSCOPE_PRICING_TIERS_JSON,
    ];
    if (
      pricingValues.some((item) => item !== undefined) &&
      pricingValues.some((item) => item === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_PRICING_MODEL"],
        message: "百炼价格模型、模式、生效日、来源和分档必须同时配置",
      });
    }
    const tiers = value.DASHSCOPE_PRICING_TIERS_JSON;
    if (
      tiers &&
      tiers.some(
        (tier, index) =>
          index > 0 && tier.maxInputTokens <= tiers[index - 1]!.maxInputTokens,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_PRICING_TIERS_JSON"],
        message: "百炼价格分档必须按最大输入 Token 严格递增",
      });
    }
    if (Math.abs(value.RAG_VECTOR_WEIGHT + value.RAG_TEXT_WEIGHT - 1) > 0.001) {
      context.addIssue({
        code: "custom",
        path: ["RAG_VECTOR_WEIGHT"],
        message: "RAG 向量权重和文本权重之和必须为 1",
      });
    }
    if (value.RAG_FINAL_K > value.RAG_TOP_K) {
      context.addIssue({
        code: "custom",
        path: ["RAG_FINAL_K"],
        message: "RAG_FINAL_K 不能大于 RAG_TOP_K",
      });
    }
    if (
      value.RAG_RERANK_ENABLED &&
      !value.DASHSCOPE_RERANK_BASE_URL &&
      !derivedDashscopeRerankBaseUrl(value.DASHSCOPE_BASE_URL)
    ) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_RERANK_BASE_URL"],
        message: "启用重排时必须配置工作空间专属 Rerank 地址",
      });
    }
    if (
      Boolean(value.HOUSING_API_BASE_URL) !== Boolean(value.HOUSING_API_KEY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["HOUSING_API_BASE_URL"],
        message: "HOUSING_API_BASE_URL 与 HOUSING_API_KEY 必须同时配置",
      });
    }
    if (
      value.HOUSING_HTTP_FALLBACK_ENABLED &&
      (!value.HOUSING_API_BASE_URL || !value.HOUSING_API_KEY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["HOUSING_HTTP_FALLBACK_ENABLED"],
        message: "启用本机房源回退时必须配置本机 URL 和密钥",
      });
    }
    if (
      value.HOUSING_HTTP_FALLBACK_ENABLED &&
      value.HOUSING_API_BASE_URL &&
      !isLocalUrl(value.HOUSING_API_BASE_URL)
    ) {
      context.addIssue({
        code: "custom",
        path: ["HOUSING_API_BASE_URL"],
        message: "房源 HTTP 回退只允许 localhost 或回环地址",
      });
    }
  });

export type PublicEnvironment = z.infer<typeof publicEnvSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvSchema>;
export type ServiceStatus = "configured" | "missing" | "disabled";

export function resolveDashscopeRerankBaseUrl(
  configuration: Pick<
    ServerEnvironment,
    "DASHSCOPE_BASE_URL" | "DASHSCOPE_RERANK_BASE_URL"
  >,
): string | undefined {
  return (
    configuration.DASHSCOPE_RERANK_BASE_URL ??
    derivedDashscopeRerankBaseUrl(configuration.DASHSCOPE_BASE_URL)
  );
}

export interface ServiceConfiguration {
  mode: "demo" | "live";
  services: {
    supabase: ServiceStatus;
    qwen: ServiceStatus;
    rerank: ServiceStatus;
    amap: ServiceStatus;
    housing: ServiceStatus;
  };
}

export function parsePublicEnv(input: EnvironmentInput): PublicEnvironment {
  return publicEnvSchema.parse(input);
}

export function parseServerEnv(input: EnvironmentInput): ServerEnvironment {
  return serverEnvSchema.parse(input);
}

export function publicEnv(): PublicEnvironment {
  return parsePublicEnv(process.env);
}

export function serverEnv(): ServerEnvironment {
  return parseServerEnv(process.env);
}

export function getServiceConfiguration(
  input: EnvironmentInput = process.env,
): ServiceConfiguration {
  const publicConfiguration = parsePublicEnv(input);
  const serverConfiguration = parseServerEnv(input);
  const rerankBaseUrl = resolveDashscopeRerankBaseUrl(serverConfiguration);
  const supabaseHousingConfigured = Boolean(
    publicConfiguration.NEXT_PUBLIC_SUPABASE_URL &&
    serverConfiguration.SUPABASE_SECRET_KEY,
  );
  const localHttpHousingConfigured = Boolean(
    serverConfiguration.HOUSING_HTTP_FALLBACK_ENABLED &&
    serverConfiguration.HOUSING_API_BASE_URL &&
    serverConfiguration.HOUSING_API_KEY &&
    isLocalUrl(serverConfiguration.HOUSING_API_BASE_URL) &&
    input.NODE_ENV !== "production",
  );

  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return {
      mode: "demo",
      services: {
        supabase: "disabled",
        qwen: "disabled",
        rerank: "disabled",
        amap: "disabled",
        housing: localHttpHousingConfigured ? "configured" : "disabled",
      },
    };
  }

  return {
    mode: "live",
    services: {
      supabase:
        publicConfiguration.NEXT_PUBLIC_SUPABASE_URL &&
        publicConfiguration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          ? "configured"
          : "missing",
      qwen: serverConfiguration.DASHSCOPE_API_KEY ? "configured" : "missing",
      rerank: !serverConfiguration.RAG_RERANK_ENABLED
        ? "disabled"
        : serverConfiguration.DASHSCOPE_API_KEY && rerankBaseUrl
          ? "configured"
          : "missing",
      amap: serverConfiguration.AMAP_WEB_SERVICE_KEY ? "configured" : "missing",
      housing:
        supabaseHousingConfigured || localHttpHousingConfigured
          ? "configured"
          : "missing",
    },
  };
}
