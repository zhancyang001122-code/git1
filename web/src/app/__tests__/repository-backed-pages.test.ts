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

describe("map page data boundaries", () => {
  it("keeps the shared location default in the root provider and never exposes the AMap key", async () => {
    const nearbySource = await readFile(
      `${appDirectory}/nearby/page.tsx`,
      "utf8",
    );
    const layoutSource = await readFile(`${appDirectory}/layout.tsx`, "utf8");

    expect(layoutSource).toContain("publicEnv");
    expect(layoutSource).toContain("SelectedLocationProvider");
    expect(nearbySource).toContain("NearbyExperience");
    expect(`${layoutSource}${nearbySource}`).not.toContain(
      "AMAP_WEB_SERVICE_KEY",
    );
    expect(nearbySource).not.toContain("createDemoRepository");
  });
});
