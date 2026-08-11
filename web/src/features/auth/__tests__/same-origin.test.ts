import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "@/features/auth/same-origin";

describe("assertSameOrigin", () => {
  it("accepts a matching browser origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://xiaozhi.example/api/auth/otp/send", {
          method: "POST",
          headers: { origin: "https://xiaozhi.example" },
        }),
      ),
    ).not.toThrow();
  });

  it("accepts the public Host origin when a local Next server normalizes request.url", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3101/api/auth/otp/send", {
          method: "POST",
          headers: {
            host: "127.0.0.1:3101",
            origin: "http://127.0.0.1:3101",
          },
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3101/api/auth/otp/send", {
          method: "POST",
          headers: {
            host: "127.0.0.1:3101",
            origin: "https://evil.example",
          },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "AUTH_ORIGIN_INVALID" }));
  });

  it("rejects a different or malformed origin", () => {
    for (const origin of ["https://evil.example", "not-a-url"]) {
      expect(() =>
        assertSameOrigin(
          new Request("https://xiaozhi.example/api/auth/otp/send", {
            method: "POST",
            headers: { origin },
          }),
        ),
      ).toThrowError(
        expect.objectContaining({ code: "AUTH_ORIGIN_INVALID", status: 403 }),
      );
    }
  });

  it("rejects a missing origin unless a trusted local caller opts in", () => {
    const request = new Request("http://127.0.0.1:3000/api/auth/otp/send", {
      method: "POST",
    });
    expect(() => assertSameOrigin(request)).toThrowError(
      expect.objectContaining({ code: "AUTH_ORIGIN_INVALID" }),
    );
    expect(() =>
      assertSameOrigin(request, { allowMissingOrigin: true }),
    ).not.toThrow();
  });
});
