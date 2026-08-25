import { describe, expect, it } from "vitest";

import {
  assertBranchDeployment,
  assertFirstPartyRag,
  assertInvalidRequestBoundary,
  assertLiveAmap,
  assertLiveHealth,
  assertRerankApplied,
  assertRentalDecisionFlow,
} from "./interview-preflight.mjs";

describe("interview preflight evidence", () => {
  it("reports provider errors before generic RAG evidence failures", () => {
    expect(() =>
      assertFirstPartyRag({
        errorCode: "QWEN_PROVIDER_TIMEOUT",
        citations: [],
        warningCodes: [],
      }),
    ).toThrow("Production first-party RAG failed: QWEN_PROVIDER_TIMEOUT");
  });

  it("reports provider errors before generic rental evidence failures", () => {
    expect(() =>
      assertRentalDecisionFlow({
        errorCode: "QWEN_PROVIDER_TIMEOUT",
        citations: [],
        cards: [],
        warningCodes: [],
      }),
    ).toThrow("Production rental-decision flow failed: QWEN_PROVIDER_TIMEOUT");
  });

  it("requires the local and Production commits to match", () => {
    expect(() =>
      assertBranchDeployment({
        localCommit: "abc123",
        deployedCommit: "abc123",
      }),
    ).not.toThrow();

    expect(() =>
      assertBranchDeployment({
        localCommit: "abc123",
        deployedCommit: "different",
      }),
    ).toThrow(/Production deployment/i);
  });

  it("requires stable invalid-request evidence", () => {
    expect(() =>
      assertInvalidRequestBoundary({
        status: 400,
        errorCode: "INVALID_CHAT_REQUEST",
        body: { error: { code: "INVALID_CHAT_REQUEST" } },
      }),
    ).not.toThrow();

    expect(() =>
      assertInvalidRequestBoundary({
        status: 500,
        errorCode: null,
        body: {},
      }),
    ).toThrow(/invalid request boundary/i);
  });

  it("requires target first-party citations without demo material", () => {
    expect(() =>
      assertFirstPartyRag({
        assistantText: "千问负责选择工具和表达，但不是事实来源。",
        toolSucceeded: true,
        errorCode: null,
        warningCodes: [],
        citations: [
          {
            title: "小智作品集：AI 事实来源与知识治理",
            materialKind: "portfolio_first_party",
            versionLabel: "2026.08.1",
            effectiveFrom: "2026-08-12",
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      assertFirstPartyRag({
        assistantText: "模型直接回答。",
        toolSucceeded: false,
        errorCode: null,
        warningCodes: [],
        citations: [],
      }),
    ).toThrow(/first-party RAG/i);

    expect(() =>
      assertFirstPartyRag({
        assistantText: "千问负责选择工具和表达，但不是事实来源。",
        toolSucceeded: true,
        errorCode: null,
        warningCodes: ["QWEN_RULE_FALLBACK"],
        citations: [
          {
            title: "小智作品集：AI 事实来源与知识治理",
            materialKind: "portfolio_first_party",
            versionLabel: "2026.08.1",
            effectiveFrom: "2026-08-12",
          },
        ],
      }),
    ).toThrow(/first-party RAG/i);
  });

  it("requires the flagship flow to use housing, maps and official RAG evidence", () => {
    expect(() =>
      assertRentalDecisionFlow({
        assistantText:
          "已查询历史房源、附近设施，并按官方资料整理签约核验建议。",
        errorCode: null,
        warningCodes: [],
        debugRuns: [],
        cards: [{ kind: "house" }, { kind: "place" }],
        citations: [
          {
            materialKind: "public_official",
            versionLabel: "国务院令第812号",
            effectiveFrom: "2025-09-15",
            sourceReference:
              "https://xzfg.moj.gov.cn/front/law/detail?LawID=1774",
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      assertRentalDecisionFlow({
        assistantText: "",
        errorCode: null,
        warningCodes: [],
        debugRuns: [{ toolName: "search_houses", errorCode: null }],
        cards: [{ kind: "house" }],
        citations: [],
      }),
    ).toThrow(/rental-decision evidence/i);
  });

  it("requires every production service to be configured in Live mode", () => {
    expect(() =>
      assertLiveHealth({
        app: "xiaozhi",
        mode: "live",
        services: {
          supabase: "configured",
          qwen: "configured",
          rerank: "configured",
          amap: "configured",
          housing: "configured",
        },
      }),
    ).not.toThrow();
    expect(() =>
      assertLiveHealth({
        app: "xiaozhi",
        mode: "live",
        services: {
          supabase: "configured",
          qwen: "missing",
          rerank: "missing",
        },
      }),
    ).toThrow(/not fully configured/i);
  });

  it("requires a knowledge search to apply rerank without falling back", () => {
    expect(() =>
      assertRerankApplied({
        chunks: [{ title: "小智作品集：历史房源边界" }],
        citations: [{ title: "小智作品集：历史房源边界" }],
        warnings: [],
        rankingStrategy: "hybrid_rerank",
      }),
    ).not.toThrow();
    expect(() =>
      assertRerankApplied({
        chunks: [{ title: "小智作品集：历史房源边界" }],
        citations: [{ title: "小智作品集：历史房源边界" }],
        warnings: ["RERANK_FALLBACK"],
        rankingStrategy: "hybrid_rerank_fallback",
      }),
    ).toThrow(/Rerank/i);
  });

  it("requires a real Live AMap geocoding response", () => {
    expect(() =>
      assertLiveAmap({
        status: 200,
        body: {
          mode: "live",
          data: {
            name: "武林广场",
            point: { longitude: 120.163102, latitude: 30.274085 },
          },
        },
      }),
    ).not.toThrow();
    expect(() =>
      assertLiveAmap({
        status: 200,
        body: {
          mode: "demo",
          data: {
            name: "武林广场",
            point: { longitude: 120.163102, latitude: 30.274085 },
          },
        },
      }),
    ).toThrow(/AMap probe/i);
  });
});
