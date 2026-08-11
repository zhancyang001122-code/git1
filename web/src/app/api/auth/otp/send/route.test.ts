import { describe, expect, it, vi } from "vitest";

import { createOtpSendHandler } from "@/app/api/auth/otp/send/route";
import type { AuthRuntime } from "@/features/auth/runtime";
import { AppError } from "@/lib/errors";

function runtime(): AuthRuntime {
  return {
    sendOtp: vi.fn(async () => undefined),
    verifyOtp: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://xiaozhi.example/api/auth/otp/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://xiaozhi.example",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp/send", () => {
  it("sends a normalized email without exposing account existence", async () => {
    const auth = runtime();
    const post = createOtpSendHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "user@example.com",
      production: true,
    });
    const response = await post(request({ email: " USER@Example.COM " }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(auth.sendOtp).toHaveBeenCalledWith({ email: "user@example.com" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects a non-allowlisted email before calling Supabase", async () => {
    const auth = runtime();
    const post = createOtpSendHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "owner@example.com",
      production: true,
    });
    const response = await post(request({ email: "user@example.com" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_EMAIL_NOT_ALLOWED", retryable: false },
    });
    expect(auth.sendOtp).not.toHaveBeenCalled();
  });

  it("fails closed in production when the demo email is not configured", async () => {
    const auth = runtime();
    const response = await createOtpSendHandler({
      runtimeFactory: async () => auth,
      allowedEmail: null,
      production: true,
    })(request({ email: "user@example.com" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_UNAVAILABLE", retryable: true },
    });
    expect(auth.sendOtp).not.toHaveBeenCalled();
  });

  it("rejects invalid or oversized bodies before calling Supabase", async () => {
    const auth = runtime();
    const post = createOtpSendHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "user@example.com",
      production: true,
    });
    const invalid = await post(request({ email: "not-an-email" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: { code: "AUTH_EMAIL_INVALID" },
    });

    const oversized = await post(
      request({ email: "user@example.com" }, { "content-length": "9000" }),
    );
    expect(oversized.status).toBe(413);
    expect(auth.sendOtp).not.toHaveBeenCalled();
  });

  it("returns stable rate-limit and provider errors", async () => {
    const auth = runtime();
    const post = createOtpSendHandler({
      runtimeFactory: async () => auth,
      allowedEmail: "user@example.com",
      production: true,
      rateLimiters: {
        client: {
          check: () => ({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 30,
          }),
        },
        email: {
          check: () => ({
            allowed: true,
            remaining: 1,
            retryAfterSeconds: 1,
          }),
        },
      },
    });
    const limited = await post(request({ email: "user@example.com" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("30");
    expect(await limited.json()).toMatchObject({
      error: { code: "AUTH_RATE_LIMITED", retryable: true },
    });

    const failing = runtime();
    vi.mocked(failing.sendOtp).mockRejectedValueOnce(
      new AppError({
        code: "AUTH_OTP_SEND_FAILED",
        message: "验证码暂时无法发送",
        status: 502,
        retryable: true,
      }),
    );
    const failed = await createOtpSendHandler({
      runtimeFactory: async () => failing,
      allowedEmail: "user@example.com",
      production: true,
    })(request({ email: "user@example.com" }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({
      error: { code: "AUTH_OTP_SEND_FAILED", retryable: true },
    });
  });
});
