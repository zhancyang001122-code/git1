import { describe, expect, it, vi } from "vitest";

import { createOtpVerifyHandler } from "@/app/api/auth/otp/verify/route";
import type { AuthRuntime } from "@/features/auth/runtime";

function runtime(): AuthRuntime {
  return {
    sendOtp: vi.fn(async () => undefined),
    verifyOtp: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

function request(body: unknown, origin = "https://xiaozhi.example") {
  return new Request("https://xiaozhi.example/api/auth/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp/verify", () => {
  it("verifies the normalized identity and returns only a safe internal next", async () => {
    const auth = runtime();
    const post = createOtpVerifyHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "user@example.com",
      production: true,
    });
    const response = await post(
      request({
        email: " USER@Example.COM ",
        token: "123456",
        next: "/me/preferences?from=chat",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      next: "/me/preferences?from=chat",
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
    });
  });

  it("falls back instead of returning an external redirect", async () => {
    const response = await createOtpVerifyHandler({
      runtimeFactory: async () => runtime(),
      allowedEmail: "user@example.com",
      production: true,
    })(
      request({
        email: "user@example.com",
        token: "123456",
        next: "https://evil.example/steal",
      }),
    );
    expect(await response.json()).toEqual({ ok: true, next: "/me" });
  });

  it("rejects invalid tokens and cross-origin requests", async () => {
    const auth = runtime();
    const post = createOtpVerifyHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "user@example.com",
      production: true,
    });
    const invalid = await post(
      request({ email: "user@example.com", token: "12a" }),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: { code: "AUTH_OTP_INVALID", retryable: false },
    });

    const crossOrigin = await post(
      request(
        { email: "user@example.com", token: "123456" },
        "https://evil.example",
      ),
    );
    expect(crossOrigin.status).toBe(403);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects non-allowlisted verification and missing production config", async () => {
    const auth = runtime();
    const blocked = await createOtpVerifyHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "owner@example.com",
      production: true,
    })(request({ email: "user@example.com", token: "123456" }));

    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      error: { code: "AUTH_EMAIL_NOT_ALLOWED", retryable: false },
    });

    const unavailable = await createOtpVerifyHandler({
      runtimeFactory: async () => auth,
      allowedEmail: null,
      production: true,
    })(request({ email: "user@example.com", token: "123456" }));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: { code: "AUTH_UNAVAILABLE", retryable: true },
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
