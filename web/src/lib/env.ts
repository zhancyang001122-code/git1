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
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_FALLBACK_TO_DEMO: stringBoolean(false),
  ANONYMOUS_COOKIE_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(32).optional(),
  ),
  DASHSCOPE_API_KEY: optionalString,
  DASHSCOPE_MODEL: z.string().min(1).default("qwen-plus"),
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
