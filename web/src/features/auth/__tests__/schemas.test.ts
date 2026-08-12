import { describe, expect, it } from "vitest";

import { demoLoginSchema } from "@/features/auth/schemas";

describe("auth request schemas", () => {
  it("requires a six-digit demo code and bounded next path input", () => {
    expect(
      demoLoginSchema.safeParse({
        code: "666666",
        next: "/me/preferences",
      }).success,
    ).toBe(true);
    expect(
      demoLoginSchema.safeParse({
        code: "12345a",
      }).success,
    ).toBe(false);
    expect(
      demoLoginSchema.safeParse({
        code: "666666",
        next: `/${"x".repeat(2_048)}`,
      }).success,
    ).toBe(false);
    expect(
      demoLoginSchema.safeParse({ code: "666666", email: "x@example.com" })
        .success,
    ).toBe(false);
  });
});
