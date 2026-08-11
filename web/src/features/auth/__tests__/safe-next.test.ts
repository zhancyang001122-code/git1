import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/features/auth/safe-next";

describe("safeNextPath", () => {
  it("keeps a normalized internal path with query and hash", () => {
    expect(safeNextPath("/me/preferences?from=chat#memory")).toBe(
      "/me/preferences?from=chat#memory",
    );
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "/%2F%2Fevil.example/steal",
    "/%5Cevil.example/steal",
    "/%250d%250aLocation:%20https://evil.example",
    "javascript:alert(1)",
    "me/preferences",
    "\u0000/me",
  ])("rejects unsafe redirect input %s", (value) => {
    expect(safeNextPath(value)).toBe("/me");
  });

  it("uses the caller fallback for missing or malformed input", () => {
    expect(safeNextPath(undefined, "/")).toBe("/");
    expect(safeNextPath("/%E0%A4%A", "/xiaozhi")).toBe("/xiaozhi");
  });
});
