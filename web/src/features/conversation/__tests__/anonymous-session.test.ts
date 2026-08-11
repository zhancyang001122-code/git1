import { describe, expect, it } from "vitest";

import {
  createAnonymousSessionCookie,
  readAnonymousSessionCookie,
} from "@/features/conversation/anonymous-session";

const secret = "test-only-anonymous-cookie-secret-32-bytes-minimum";

describe("anonymous session cookie", () => {
  it("creates a high-entropy opaque id and verifies its signature", () => {
    const created = createAnonymousSessionCookie(secret);

    expect(created.anonymousId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.value).not.toBe(created.anonymousId);
    expect(readAnonymousSessionCookie(created.value, secret)).toBe(
      created.anonymousId,
    );
  });

  it("rejects a modified id or signature", () => {
    const created = createAnonymousSessionCookie(secret);
    const replacement = created.value.startsWith("x") ? "y" : "x";
    expect(
      readAnonymousSessionCookie(`${created.value.slice(0, -1)}x`, secret),
    ).toBeNull();
    expect(
      readAnonymousSessionCookie(
        `${replacement}${created.value.slice(1)}`,
        secret,
      ),
    ).toBeNull();
  });

  it("rejects a signing secret shorter than 32 characters", () => {
    expect(() => createAnonymousSessionCookie("too-short")).toThrowError(
      expect.objectContaining({ code: "ANONYMOUS_COOKIE_SECRET_INVALID" }),
    );
  });
});
