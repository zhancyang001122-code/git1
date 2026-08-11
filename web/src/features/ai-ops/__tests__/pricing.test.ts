import { describe, expect, it } from "vitest";

import {
  estimateAIModelCost,
  pricingConfigurationFromEnvironment,
  type AIModelPricingConfiguration,
} from "@/features/ai-ops/pricing";

const pricing: AIModelPricingConfiguration = {
  model: "qwen-plus",
  modeLabel: "非思考模式",
  effectiveFrom: "2026-08-12",
  sourceUrl: "https://help.aliyun.com/zh/model-studio/qwen-plus",
  tiers: [
    {
      maxInputTokens: 128_000,
      inputCnyPerMillion: 0.8,
      outputCnyPerMillion: 2,
    },
    {
      maxInputTokens: 256_000,
      inputCnyPerMillion: 2.4,
      outputCnyPerMillion: 20,
    },
    {
      maxInputTokens: 1_000_000,
      inputCnyPerMillion: 4.8,
      outputCnyPerMillion: 48,
    },
  ],
};

describe("AI model cost estimation", () => {
  it("loads pricing only when the complete auditable configuration is present", () => {
    expect(pricingConfigurationFromEnvironment({})).toBeNull();
    expect(() =>
      pricingConfigurationFromEnvironment({
        DASHSCOPE_PRICING_MODEL: "qwen-plus",
      }),
    ).toThrow(/必须同时配置/);

    expect(
      pricingConfigurationFromEnvironment({
        DASHSCOPE_PRICING_MODEL: pricing.model,
        DASHSCOPE_PRICING_MODE_LABEL: pricing.modeLabel,
        DASHSCOPE_PRICING_EFFECTIVE_FROM: pricing.effectiveFrom,
        DASHSCOPE_PRICING_SOURCE_URL: pricing.sourceUrl,
        DASHSCOPE_PRICING_TIERS_JSON: JSON.stringify(pricing.tiers),
      }),
    ).toEqual(pricing);
  });

  it("prices every request with its own input-length tier", () => {
    const estimate = estimateAIModelCost(
      [
        {
          modelName: "qwen-plus",
          inputTokens: 2_000,
          outputTokens: 1_000,
          requests: 2,
        },
        {
          modelName: "qwen-plus",
          inputTokens: 200_000,
          outputTokens: 1_000,
          requests: 1,
        },
      ],
      pricing,
    );

    expect(estimate).toMatchObject({
      status: "complete",
      estimatedCostCny: 0.5072,
      coveredRequests: 3,
      totalRequests: 3,
      unpricedRequests: 0,
      pricing,
    });
  });

  it("reports partial coverage instead of pricing another model or missing usage", () => {
    const estimate = estimateAIModelCost(
      [
        {
          modelName: "qwen-plus",
          inputTokens: 2_000,
          outputTokens: 1_000,
          requests: 2,
        },
        {
          modelName: "qwen-max",
          inputTokens: 1_000,
          outputTokens: 500,
          requests: 1,
        },
        {
          modelName: "qwen-plus",
          inputTokens: null,
          outputTokens: null,
          requests: 1,
        },
      ],
      pricing,
    );

    expect(estimate).toMatchObject({
      status: "partial",
      estimatedCostCny: 0.0072,
      coveredRequests: 2,
      totalRequests: 4,
      unpricedRequests: 2,
    });
  });
});
