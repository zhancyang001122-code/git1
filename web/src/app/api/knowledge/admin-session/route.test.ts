import { describe, expect, it } from "vitest";

import { createKnowledgeAdminSessionHandler } from "@/app/api/knowledge/admin-session/route";

const token = "demo-admin-token-that-is-at-least-32-chars";

describe("POST /api/knowledge/admin-session", () => {
  it("sets an HttpOnly session cookie without returning the token", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const form = new FormData();
    form.set("token", token);

    const response = await post(
      new Request("http://localhost/api/knowledge/admin-session", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
    expect(response.headers.get("set-cookie")).not.toContain(token);
    expect(response.headers.get("location")).toBe("/knowledge-admin");
  });

  it("marks the session cookie secure for HTTPS requests", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const form = new FormData();
    form.set("token", token);

    const response = await post(
      new Request("https://example.com/api/knowledge/admin-session", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects an invalid token", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const form = new FormData();
    form.set("token", "wrong-token");

    const response = await post(
      new Request("http://localhost/api/knowledge/admin-session", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(token);
  });
});
