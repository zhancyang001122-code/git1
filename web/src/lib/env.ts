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
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    SUPABASE_FALLBACK_TO_DEMO: stringBoolean(false),
    ANONYMOUS_COOKIE_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).optional(),
    ),
    DASHSCOPE_API_KEY: optionalString,
    DASHSCOPE_MODEL: z.string().min(1).default("qwen-plus"),
    DASHSCOPE_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-v4"),
    DASHSCOPE_EMBEDDING_DIMENSIONS: integerFromString(1024, 1024, 1024),
    DASHSCOPE_RERANK_MODEL: z.string().min(1).default("qwen3-rerank"),
    DASHSCOPE_RERANK_BASE_URL: optionalUrl,
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
    AI_REQUEST_TIMEOUT_MS: integerFromString(30_000, 1_000, 120_000),
    TOOL_TIMEOUT_MS: integerFromString(8_000, 100, 30_000),
    AI_MAX_TOOL_ROUNDS: integerFromString(8, 1, 8),
    AMAP_WEB_SERVICE_KEY: optionalString,
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
    if (value.RAG_RERANK_ENABLED && !value.DASHSCOPE_RERANK_BASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_RERANK_BASE_URL"],
        message: "启用重排时必须配置工作空间专属 Rerank 地址",
      });
    }
  });

export type PublicEnvironment = z.infer<typeof publicEnvSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvSchema>;
export type ServiceStatus = "configured" | "missing" | "disabled";

export interface ServiceConfiguration {
  mode: "demo" | "live";
  services: {
    supabase: ServiceStatus;
    qwen: ServiceStatus;
    amap: ServiceStatus;
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

  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return {
      mode: "demo",
      services: {
        supabase: "disabled",
        qwen: "disabled",
        amap: "disabled",
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
      amap: serverConfiguration.AMAP_WEB_SERVICE_KEY ? "configured" : "missing",
    },
  };
}
