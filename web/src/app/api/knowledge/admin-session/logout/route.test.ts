import { describe, expect, it } from "vitest";

import { createKnowledgeAdminLogoutHandler } from "@/app/api/knowledge/admin-session/logout/route";
import { KNOWLEDGE_ADMIN_SESSION_COOKIE } from "@/features/knowledge-ops/admin-session";

describe("POST /api/knowledge/admin-session/logout", () => {
  it("clears the admin session and redirects to login", async () => {
    const response = await createKnowledgeAdminLogoutHandler({
      allowMissingOrigin: true,
    })(
      new Request(
        "https://xiaozhi.example/api/knowledge/admin-session/logout",
        { method: "POST" },
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/knowledge-admin/login");
    expect(response.headers.get("set-cookie")).toContain(
      `${KNOWLEDGE_ADMIN_SESSION_COOKIE}=`,
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  });

  it("rejects cross-origin logout", async () => {
    const response = await createKnowledgeAdminLogoutHandler({
      allowMissingOrigin: false,
    })(
      new Request(
        "https://xiaozhi.example/api/knowledge/admin-session/logout",
        {
          method: "POST",
          headers: { origin: "https://evil.example" },
        },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTH_ORIGIN_INVALID" },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
