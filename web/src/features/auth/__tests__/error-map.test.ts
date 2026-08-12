import { describe, expect, it } from "vitest";

import {
  isMissingAuthSession,
  mapSupabaseAuthError,
} from "@/features/auth/error-map";

describe("Supabase auth error mapping", () => {
  it("keeps provider rate limits stable", () => {
    expect(
      mapSupabaseAuthError({ status: 429, code: "over_request_rate_limit" }),
    ).toMatchObject({
      code: "AUTH_RATE_LIMITED",
      status: 429,
      retryable: true,
    });
  });

  it("does not classify unknown provider failures as user input errors", () => {
    expect(mapSupabaseAuthError(new Error("socket closed"))).toMatchObject({
      code: "AUTH_UNAVAILABLE",
      status: 503,
      retryable: true,
    });
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
