import type { EnvironmentInput } from "@/lib/env";
import { parseServerEnv } from "@/lib/env";

export interface AIModelUsageBucket {
  modelName: string;
  inputTokens: number | null;
  outputTokens: number | null;
  requests: number;
}

export interface AIModelPricingTier {
  maxInputTokens: number;
  inputCnyPerMillion: number;
  outputCnyPerMillion: number;
}

export interface AIModelPricingConfiguration {
  model: string;
  modeLabel: string;
  effectiveFrom: string;
  sourceUrl: string;
  tiers: readonly AIModelPricingTier[];
}

export interface AIModelCostEstimate {
  status: "complete" | "partial";
  estimatedCostCny: number;
  coveredRequests: number;
  totalRequests: number;
  unpricedRequests: number;
  pricing: AIModelPricingConfiguration;
}

export interface AIRequestUsage {
  modelName: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export function estimateAIRequestCost(
  usage: AIRequestUsage,
  pricing: AIModelPricingConfiguration,
): number | null {
  if (
    usage.modelName !== pricing.model ||
    usage.inputTokens === null ||
    usage.outputTokens === null
  ) {
    return null;
  }
  const tier = pricing.tiers.find(
    (candidate) => usage.inputTokens! <= candidate.maxInputTokens,
  );
  if (!tier) return null;
  return Number(
    (
      (usage.inputTokens * tier.inputCnyPerMillion) / 1_000_000 +
      (usage.outputTokens * tier.outputCnyPerMillion) / 1_000_000
    ).toFixed(6),
  );
}

export function pricingConfigurationFromEnvironment(
  input: EnvironmentInput,
): AIModelPricingConfiguration | null {
  const environment = parseServerEnv(input);
  if (!environment.DASHSCOPE_PRICING_MODEL) return null;
  return {
    model: environment.DASHSCOPE_PRICING_MODEL,
    modeLabel: environment.DASHSCOPE_PRICING_MODE_LABEL!,
    effectiveFrom: environment.DASHSCOPE_PRICING_EFFECTIVE_FROM!,
    sourceUrl: environment.DASHSCOPE_PRICING_SOURCE_URL!,
    tiers: environment.DASHSCOPE_PRICING_TIERS_JSON!,
  };
}

export function estimateAIModelCost(
  usage: readonly AIModelUsageBucket[],
  pricing: AIModelPricingConfiguration,
): AIModelCostEstimate {
  let cost = 0;
  let coveredRequests = 0;
  let totalRequests = 0;

  for (const bucket of usage) {
    totalRequests += bucket.requests;
    const requestCost = estimateAIRequestCost(bucket, pricing);
    if (requestCost === null) continue;
    coveredRequests += bucket.requests;
    cost += bucket.requests * requestCost;
  }

  const unpricedRequests = totalRequests - coveredRequests;
  return {
    status: unpricedRequests === 0 ? "complete" : "partial",
    estimatedCostCny: Number(cost.toFixed(6)),
    coveredRequests,
    totalRequests,
    unpricedRequests,
    pricing,
  };
}
