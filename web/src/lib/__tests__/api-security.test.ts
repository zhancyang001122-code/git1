import { describe, expect, it, vi } from "vitest";

import { readJsonWithLimit, readTextWithLimit } from "@/lib/api-security";

describe("readTextWithLimit", () => {
  it("rejects an oversized declared body without reading the stream", async () => {
    const request = new Request("http://localhost/api/form", {
      method: "POST",
      headers: { "content-length": "5000" },
      body: "short-body",
    });
    const text = vi.spyOn(request, "text");

    await expect(readTextWithLimit(request, 4_096)).rejects.toMatchObject({
      code: "REQUEST_BODY_TOO_LARGE",
      status: 413,
    });
    expect(text).not.toHaveBeenCalled();
  });
});

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
