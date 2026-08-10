import { expect, test } from "@playwright/test";

test("home stays within the portfolio JavaScript and navigation budgets", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const budget = await page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    const scripts = resources.filter(
      (entry) => entry.initiatorType === "script",
    );
    return {
      navigationMs: navigation.duration,
      scriptBytes: scripts.reduce(
        (total, entry) =>
          total + (entry.transferSize || entry.encodedBodySize || 0),
        0,
      ),
      scriptCount: scripts.length,
    };
  });

  expect(budget.navigationMs).toBeLessThan(10_000);
  expect(budget.scriptBytes).toBeLessThan(2_000_000);
  expect(budget.scriptCount).toBeLessThan(40);
});
