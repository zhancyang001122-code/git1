import { describe, expect, it } from "vitest";

import { requestIdFor } from "@/lib/request-id";

describe("requestIdFor", () => {
  it("keeps a valid upstream UUID and replaces untrusted values", () => {
    const id = "81000000-0000-4000-8000-000000000001";
    expect(
      requestIdFor(
        new Request("http://localhost", { headers: { "x-request-id": id } }),
      ),
    ).toBe(id);
    expect(
      requestIdFor(
        new Request("http://localhost", {
          headers: { "x-request-id": "<script>bad</script>" },
        }),
      ),
    ).toMatch(/^[0-9a-f-]{36}$/);
  });
});
