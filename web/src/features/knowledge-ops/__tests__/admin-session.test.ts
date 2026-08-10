import { describe, expect, it } from "vitest";

import {
  createKnowledgeAdminSession,
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
});
