import { describe, expect, it, vi } from "vitest";

import { createDemoLoginHandler } from "@/app/api/auth/demo-login/route";
import type { AuthRuntime } from "@/features/auth/runtime";

function runtime(): AuthRuntime {
  return {
    signInDemo: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

function request(body: unknown, origin = "https://xiaozhi.example") {
  return new Request("https://xiaozhi.example/api/auth/demo-login", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/demo-login", () => {
  it("signs in the isolated demo account and returns a safe path", async () => {
    const auth = runtime();
    const response = await createDemoLoginHandler({
      runtimeFactory: async () => auth,
    })(request({ code: "666666", next: "/me/preferences?from=login" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      next: "/me/preferences?from=login",
    });
    expect(auth.signInDemo).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a wrong code without touching Supabase", async () => {
    const auth = runtime();
    const response = await createDemoLoginHandler({
      runtimeFactory: async () => auth,
    })(request({ code: "123456" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_DEMO_CODE_INVALID", retryable: false },
    });
    expect(auth.signInDemo).not.toHaveBeenCalled();
  });

  it("blocks cross-origin and rate-limited requests", async () => {
    const auth = runtime();
    const crossOrigin = await createDemoLoginHandler({
      runtimeFactory: async () => auth,
    })(request({ code: "666666" }, "https://evil.example"));
    expect(crossOrigin.status).toBe(403);

    const limited = await createDemoLoginHandler({
      runtimeFactory: async () => auth,
      rateLimiter: {
        check: () => ({
          allowed: false,
          remaining: 0,
          retryAfterSeconds: 30,
        }),
      },
    })(request({ code: "666666" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("30");
    expect(auth.signInDemo).not.toHaveBeenCalled();
  });

  it("never returns an external next URL", async () => {
    const response = await createDemoLoginHandler({
      runtimeFactory: async () => runtime(),
    })(
      request({
        code: "666666",
        next: "https://evil.example/steal",
      }),
    );
    expect(await response.json()).toEqual({ ok: true, next: "/me" });
  });
});
