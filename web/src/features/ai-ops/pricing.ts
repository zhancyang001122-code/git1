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
    const tier =
      bucket.inputTokens === null
        ? undefined
        : pricing.tiers.find(
            (candidate) => bucket.inputTokens! <= candidate.maxInputTokens,
          );
    if (
      bucket.modelName !== pricing.model ||
      bucket.inputTokens === null ||
      bucket.outputTokens === null ||
      !tier
    ) {
      continue;
    }
    coveredRequests += bucket.requests;
    cost +=
      bucket.requests *
      ((bucket.inputTokens * tier.inputCnyPerMillion) / 1_000_000 +
        (bucket.outputTokens * tier.outputCnyPerMillion) / 1_000_000);
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
