import { expect, test } from "@playwright/test";

for (const width of [360, 390, 430]) {
  test(`mobile shell fits ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主导航" });
    await expect(navigation).toBeVisible();
    await expect(navigation).toHaveCount(1);

    const navigationBox = await navigation.boundingBox();
    expect(navigationBox).not.toBeNull();
    expect(navigationBox!.x).toBeGreaterThanOrEqual(0);
    expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(width);

    const sizes = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.viewportWidth);
  });
}
