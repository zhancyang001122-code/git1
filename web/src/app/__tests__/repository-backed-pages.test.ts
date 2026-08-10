import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const appDirectory = join(process.cwd(), "src", "app");
const businessPages = [
  "houses/page.tsx",
  "houses/[id]/page.tsx",
  "deals/page.tsx",
  "deals/[id]/page.tsx",
  "market/page.tsx",
  "market/stores/[id]/page.tsx",
  "market/products/[id]/page.tsx",
  "nearby/page.tsx",
  "discover/page.tsx",
  "discover/[id]/page.tsx",
  "cart/page.tsx",
];

describe("business page data boundaries", () => {
  it.each(businessPages)(
    "%s reads through the repository factory",
    async (relativePath) => {
      const source = await readFile(`${appDirectory}/${relativePath}`, "utf8");

      expect(source).toContain("createRepositories");
      expect(source).not.toContain("createDemoRepository");
      expect(source).not.toMatch(
        /from ["']@\/features\/business\/demo-data["']/,
      );
    },
  );
});
