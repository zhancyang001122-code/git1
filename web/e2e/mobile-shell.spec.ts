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

test("shared glass surfaces and focus feedback use the unified visual system", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/xiaozhi");

  const canvas = page.locator(".mobile-canvas-shell");
  const header = page.getByRole("banner");
  const navigation = page.getByRole("navigation", { name: "主导航" });
  const task = page.getByRole("link", { name: /找预算内一居室/ });

  await expect(canvas).toBeVisible();
  await expect(header).toHaveClass(/glass-navigation/);
  await expect(navigation).toHaveClass(/glass-navigation/);
  await expect(task).toHaveClass(/ui-interactive/);
  await expect(page.getByText(/当前为 Live 作品集/)).toBeVisible();
  await expect(page.getByText(/武林广场附近有哪些/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("姝︽灄骞垮満");

  const visualStyles = await page.evaluate(() => {
    const canvasElement = document.querySelector<HTMLElement>(
      ".mobile-canvas-shell",
    );
    const headerElement = document.querySelector<HTMLElement>("header");
    if (!canvasElement || !headerElement) return null;
    return {
      canvasBackground: getComputedStyle(canvasElement).backgroundImage,
      headerBackdrop: getComputedStyle(headerElement).backdropFilter,
    };
  });
  expect(visualStyles).not.toBeNull();
  expect(visualStyles!.canvasBackground).not.toBe("none");
  expect(visualStyles!.headerBackdrop).toContain("blur");

  await task.focus();
  const focusShadow = await task.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(focusShadow).not.toBe("none");
});

test("main pages keep one centered canvas and the same glass navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });

  const positions: number[] = [];
  for (const path of ["/", "/discover", "/xiaozhi", "/messages", "/me"]) {
    await page.goto(path);

    const navigation = page.getByRole("navigation", { name: "主导航" });
    await expect(navigation).toHaveClass(/bottom-navigation-glass/);

    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>(
        ".mobile-canvas-shell",
      );
      const nav = document.querySelector<HTMLElement>(
        'nav[aria-label="主导航"]',
      );
      if (!canvas || !nav) return null;
      return {
        canvasLeft: canvas.getBoundingClientRect().left,
        canvasWidth: canvas.getBoundingClientRect().width,
        navLeft: nav.getBoundingClientRect().left,
        navWidth: nav.getBoundingClientRect().width,
        navBackdrop: getComputedStyle(nav).backdropFilter,
        navBackgroundImage: getComputedStyle(nav).backgroundImage,
        scrollbarGutter: getComputedStyle(
          document.documentElement,
        ).scrollbarGutter,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.scrollbarGutter).toBe("stable both-edges");
    expect(metrics!.navBackdrop).toContain("blur");
    expect(metrics!.navBackgroundImage).not.toBe("none");
    expect(metrics!.canvasWidth).toBe(430);
    expect(metrics!.navWidth).toBe(430);
    expect(metrics!.navLeft).toBeCloseTo(metrics!.canvasLeft, 1);
    positions.push(metrics!.canvasLeft);
  }

  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(0.5);
});
