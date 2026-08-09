import { expect, test } from "@playwright/test";

for (const width of [360, 390, 430]) {
  test(`mobile shell fits ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("navigation", { name: "主导航" }),
    ).toBeVisible();
    const sizes = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.viewportWidth);
  });
}
