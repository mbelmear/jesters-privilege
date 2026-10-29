import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";

// Axe samples colors as rendered, so let an opening fade finish first.
const settled = (locator: Locator) =>
  locator.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );

test.describe("Style guide", () => {
  test("is kept out of search engines", async ({ page }) => {
    await page.goto("/styleguide");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/styleguide");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  // Both panels show every token in both themes; scanning under each system
  // setting also checks the page chrome around them.
  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no detectable accessibility violations (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/styleguide");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("the restyled menu and dialog open and pass an accessibility scan", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    const light = page.getByRole("region", { name: "Light theme" });

    await light.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await settled(page.getByRole("menu"));
    expect(
      (await new AxeBuilder({ page }).include("[role=menu]").analyze())
        .violations
    ).toEqual([]);
    await page.keyboard.press("Escape");

    await light.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Resume where you left off?",
    });
    await expect(dialog).toBeVisible();
    await settled(dialog);
    expect(
      (await new AxeBuilder({ page }).include("[role=dialog]").analyze())
        .violations
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("Reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("CSS transitions finish at once", async ({ page }) => {
    await page.goto("/styleguide");
    const duration = await page
      .getByRole("button", { name: "Open menu" })
      .first()
      .evaluate((button) => getComputedStyle(button).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });

  test("Motion animations finish at once", async ({ page }) => {
    await page.goto("/styleguide");
    const light = page.getByRole("region", { name: "Light theme" });
    const replay = light.getByRole("button", { name: "Replay processional" });
    const bar = replay.locator("xpath=..").locator("div > div").first();
    const shortfall = () =>
      bar.evaluate((el) => {
        const track = el.parentElement?.getBoundingClientRect().width ?? 0;
        return Math.round(el.getBoundingClientRect().width - track);
      });

    // The first sweep finishing shows Motion's lazily loaded animation code
    // has arrived, so the timing below measures the animation, not the load.
    await expect.poll(shortfall).toBe(0);

    await replay.click();
    // The processional preset takes most of a second; reduced, it's instant.
    await expect.poll(shortfall, { timeout: 300, intervals: [50] }).toBe(0);
  });
});
