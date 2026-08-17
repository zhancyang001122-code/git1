import { describe, expect, it } from "vitest";

import {
  assertBranchDeployment,
  assertFirstPartyRag,
  assertInvalidRequestBoundary,
  assertLiveAmap,
  assertLiveHealth,
} from "./interview-preflight.mjs";

describe("interview preflight evidence", () => {
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

  it("requires every production service to be configured in Live mode", () => {
    expect(() =>
      assertLiveHealth({
        app: "xiaozhi",
        mode: "live",
        services: {
          supabase: "configured",
          qwen: "configured",
          amap: "configured",
          housing: "configured",
        },
      }),
    ).not.toThrow();
    expect(() =>
      assertLiveHealth({
        app: "xiaozhi",
        mode: "live",
        services: { supabase: "configured", qwen: "missing" },
      }),
    ).toThrow(/not fully configured/i);
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
