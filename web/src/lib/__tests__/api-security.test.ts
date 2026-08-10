import { describe, expect, it } from "vitest";

import { readJsonWithLimit } from "@/lib/api-security";

describe("readJsonWithLimit", () => {
  it("rejects oversized payloads before schema or provider work", async () => {
    await expect(
      readJsonWithLimit(
        new Request("http://localhost/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: "x".repeat(100) }),
        }),
        32,
      ),
    ).rejects.toMatchObject({ code: "REQUEST_BODY_TOO_LARGE", status: 413 });
  });

  it("returns a stable invalid JSON error", async () => {
    await expect(
      readJsonWithLimit(
        new Request("http://localhost/api/chat", {
          method: "POST",
          body: "not-json",
        }),
        100,
      ),
    ).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
  });
});
