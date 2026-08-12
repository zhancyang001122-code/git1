import { describe, expect, it } from "vitest";

import {
  assertBranchDeployment,
  assertFirstPartyRag,
  assertInvalidRequestBoundary,
  expectedBackupFiles,
} from "./interview-preflight.mjs";

describe("interview preflight evidence", () => {
  it("requires the current branch commit to have a successful Vercel status", () => {
    expect(() =>
      assertBranchDeployment({
        localCommit: "abc123",
        remoteCommit: "abc123",
        statuses: [{ context: "Vercel", state: "success" }],
      }),
    ).not.toThrow();

    expect(() =>
      assertBranchDeployment({
        localCommit: "abc123",
        remoteCommit: "different",
        statuses: [{ context: "Vercel", state: "success" }],
      }),
    ).toThrow(/does not match/i);
    expect(() =>
      assertBranchDeployment({
        localCommit: "abc123",
        remoteCommit: "abc123",
        statuses: [{ context: "Vercel", state: "pending" }],
      }),
    ).toThrow(/Vercel deployment/i);
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
        citations: [],
      }),
    ).toThrow(/first-party RAG/i);
  });

  it("lists every required offline backup artifact", () => {
    expect(expectedBackupFiles()).toEqual(
      expect.arrayContaining([
        "index.html",
        "production-qr.png",
        "recording-evidence.json",
        "screens/index.html",
        "videos/01-housing-amap.webm",
        "videos/02-first-party-rag.webm",
        "videos/03-commerce-preference.webm",
      ]),
    );
  });
});
