import { describe, expect, it } from "vitest";

import { createKnowledgeAdminSessionHandler } from "@/app/api/knowledge/admin-session/route";

const token = "demo-admin-token-that-is-at-least-32-chars";

function loginRequest(url: string, value: string, origin?: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(origin && { origin }),
    },
    body: new URLSearchParams({ token: value }),
  });
}

describe("POST /api/knowledge/admin-session", () => {
  it("sets an HttpOnly session cookie without returning the token", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const response = await post(
      loginRequest("http://localhost/api/knowledge/admin-session", token),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
    expect(response.headers.get("set-cookie")).not.toContain(token);
    expect(response.headers.get("location")).toBe("/knowledge-admin");
  });

  it("marks the session cookie secure for HTTPS requests", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const response = await post(
      loginRequest("https://example.com/api/knowledge/admin-session", token),
    );

    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects an invalid token", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const response = await post(
      loginRequest(
        "http://localhost/api/knowledge/admin-session",
        "wrong-token",
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(token);
  });

  it("rejects cross-origin login before checking the token", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token, {
      allowMissingOrigin: false,
    });
    const response = await post(
      loginRequest(
        "https://xiaozhi.example/api/knowledge/admin-session",
        token,
        "https://evil.example",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTH_ORIGIN_INVALID" },
    });
  });

  it("rejects an oversized login form before parsing it", async () => {
    const post = createKnowledgeAdminSessionHandler(() => token);
    const response = await post(
      loginRequest(
        "http://localhost/api/knowledge/admin-session",
        "x".repeat(5_000),
      ),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_BODY_TOO_LARGE" },
    });
  });
});
