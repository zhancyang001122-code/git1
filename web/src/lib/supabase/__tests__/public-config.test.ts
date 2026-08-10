import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("browser Supabase environment contract", () => {
  it("uses direct NEXT_PUBLIC property access so Next.js can inline browser values", async () => {
    const source = await readFile(
      join(process.cwd(), "src", "lib", "supabase", "config.ts"),
      "utf8",
    );

    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });
});
