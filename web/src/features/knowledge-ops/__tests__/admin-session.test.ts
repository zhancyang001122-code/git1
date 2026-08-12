import { describe, expect, it } from "vitest";

import {
  createKnowledgeAdminSession,
  isKnowledgeAdminRequestAuthorized,
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
  verifyKnowledgeAdminSession,
} from "@/features/knowledge-ops/admin-session";

describe("knowledge admin session", () => {
  it("creates a signed cookie value without exposing the configured token", () => {
    const token = "demo-admin-token-that-is-at-least-32-chars";
    const cookie = createKnowledgeAdminSession(token);

    expect(cookie).not.toContain(token);
    expect(verifyKnowledgeAdminSession(cookie, token)).toBe(true);
    expect(verifyKnowledgeAdminSession(`${cookie}tampered`, token)).toBe(false);
  });

  it("requires same-origin for cookie writes but preserves Bearer automation", () => {
    const token = "demo-admin-token-that-is-at-least-32-chars";
    const cookie = createKnowledgeAdminSession(token);
    const crossOriginCookieWrite = new Request(
      "https://xiaozhi.example/api/knowledge/evaluate",
      {
        method: "POST",
        headers: {
          cookie: `${KNOWLEDGE_ADMIN_SESSION_COOKIE}=${cookie}`,
          origin: "https://evil.example",
        },
      },
    );
    const bearerAutomation = new Request(
      "https://xiaozhi.example/api/knowledge/evaluate",
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(() =>
      isKnowledgeAdminRequestAuthorized(crossOriginCookieWrite, token),
    ).toThrowError(expect.objectContaining({ code: "AUTH_ORIGIN_INVALID" }));
    expect(isKnowledgeAdminRequestAuthorized(bearerAutomation, token)).toBe(
      true,
    );
  });
});
