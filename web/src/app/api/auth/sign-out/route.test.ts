import { describe, expect, it, vi } from "vitest";

import { createSignOutHandler } from "@/app/api/auth/sign-out/route";
import type { AuthRuntime } from "@/features/auth/runtime";
import { AppError } from "@/lib/errors";

function runtime(): AuthRuntime {
  return {
    signInDemo: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

function request(origin = "https://xiaozhi.example") {
  return new Request("https://xiaozhi.example/api/auth/sign-out", {
    method: "POST",
    headers: { origin },
  });
}

describe("POST /api/auth/sign-out", () => {
  it("signs out the current session without deleting preferences", async () => {
    const auth = runtime();
    const response = await createSignOutHandler({
      runtimeFactory: async () => auth,
    })(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("normalizes provider failure and rejects cross-origin calls", async () => {
    const auth = runtime();
    vi.mocked(auth.signOut).mockRejectedValueOnce(
      new AppError({
        code: "AUTH_UNAVAILABLE",
        message: "登录服务暂时不可用",
        status: 503,
        retryable: true,
      }),
    );
    const post = createSignOutHandler({ runtimeFactory: async () => auth });
    const failed = await post(request());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({
      error: { code: "AUTH_UNAVAILABLE", retryable: true },
    });

    const crossOrigin = await createSignOutHandler({
      runtimeFactory: async () => runtime(),
    })(request("https://evil.example"));
    expect(crossOrigin.status).toBe(403);
  });
});
