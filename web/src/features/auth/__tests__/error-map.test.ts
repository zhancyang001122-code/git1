import { describe, expect, it } from "vitest";

import {
  isMissingAuthSession,
  mapSupabaseAuthError,
} from "@/features/auth/error-map";

describe("Supabase auth error mapping", () => {
  it("separates rate limits, invalid email and invalid OTP", () => {
    expect(
      mapSupabaseAuthError(
        { status: 429, code: "over_email_send_rate_limit" },
        "send",
      ),
    ).toMatchObject({
      code: "AUTH_RATE_LIMITED",
      status: 429,
      retryable: true,
    });
    expect(
      mapSupabaseAuthError({ code: "email_address_invalid" }, "send"),
    ).toMatchObject({
      code: "AUTH_EMAIL_INVALID",
      status: 400,
      retryable: false,
    });
    expect(
      mapSupabaseAuthError({ status: 400, code: "otp_expired" }, "verify"),
    ).toMatchObject({
      code: "AUTH_OTP_INVALID",
      status: 400,
      retryable: false,
    });
  });

  it("does not classify unknown provider failures as user input errors", () => {
    expect(
      mapSupabaseAuthError(new Error("socket closed"), "send"),
    ).toMatchObject({
      code: "AUTH_OTP_SEND_FAILED",
      status: 502,
      retryable: true,
    });
    expect(
      mapSupabaseAuthError(new Error("socket closed"), "verify"),
    ).toMatchObject({ code: "AUTH_UNAVAILABLE", status: 503, retryable: true });
  });

  it("recognizes an already signed-out session without swallowing other errors", () => {
    expect(isMissingAuthSession({ code: "session_not_found" })).toBe(true);
    expect(
      isMissingAuthSession({
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      }),
    ).toBe(true);
    expect(isMissingAuthSession(new Error("database unavailable"))).toBe(false);
  });
});
