import { describe, expect, it } from "vitest";

import { otpSendSchema, otpVerifySchema } from "@/features/auth/schemas";

describe("auth request schemas", () => {
  it("normalizes a valid email without accepting captcha fields", () => {
    expect(otpSendSchema.parse({ email: "  USER@Example.COM " })).toEqual({
      email: "user@example.com",
    });
    expect(
      otpSendSchema.safeParse({
        email: "user@example.com",
        captchaToken: "obsolete-captcha-token",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed email and unknown send fields", () => {
    expect(otpSendSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
    expect(
      otpSendSchema.safeParse({
        email: "user@example.com",
        userId: "70000000-0000-0000-0000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("requires a six-digit token and bounded next path input", () => {
    expect(
      otpVerifySchema.safeParse({
        email: "user@example.com",
        token: "123456",
        next: "/me/preferences",
      }).success,
    ).toBe(true);
    expect(
      otpVerifySchema.safeParse({
        email: "user@example.com",
        token: "12345a",
      }).success,
    ).toBe(false);
    expect(
      otpVerifySchema.safeParse({
        email: "user@example.com",
        token: "123456",
        next: `/${"x".repeat(2_048)}`,
      }).success,
    ).toBe(false);
  });
});
