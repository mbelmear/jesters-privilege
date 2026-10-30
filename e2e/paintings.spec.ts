import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The style guide's paintings page: a painting band on the first screen and
// framed paintings below, as the Fools' Gallery will show them.
const PAGE = "/styleguide/paintings";

const band = (page: Page) => page.getByRole("figure").first().getByRole("img");
const zooms = async (page: Page) => {
  await expect(band(page)).toBeVisible();
  return band(page).evaluate((img) => img.getAnimations().length);
};
const isWide = (page: Page, min: number) =>
  (page.viewportSize()?.width ?? 0) >= min;

test.describe("Paintings", () => {
  test("every painting loads from the build's image set", async ({ page }) => {
    await page.goto(PAGE);
    const images = page.getByRole("main").getByRole("img");
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      // Playwright's own scroll waits for the element to hold still, which
      // the zooming band never does.
      await image.evaluate((img) => img.scrollIntoView());
      await expect
        .poll(() =>
          image.evaluate((img: HTMLImageElement) =>
            img.complete ? img.naturalWidth : 0
          )
        )
        .toBeGreaterThan(0);
      expect(
        await image.evaluate((img: HTMLImageElement) => img.currentSrc)
      ).toMatch(/\/images\/paintings\/[a-z-]+\/[a-z-]*\d+\.(avif|webp)$/);
    }
  });

  test("phones get the band's portrait crop, wider screens the whole painting", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await expect
      .poll(() =>
        band(page).evaluate((img: HTMLImageElement) => img.currentSrc)
      )
      .toMatch(isWide(page, 768) ? /\/\d+\.\w+$/ : /\/portrait-\d+\.\w+$/);
  });

  test("the band slowly zooms on desktops only", async ({ page }) => {
    await page.goto(PAGE);
    expect(await zooms(page)).toBe(isWide(page, 1024) ? 1 : 0);
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto(PAGE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is kept out of search engines", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no detectable accessibility violations (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(PAGE);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("Paintings with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the band holds still", async ({ page }) => {
    await page.goto(PAGE);
    expect(await zooms(page)).toBe(0);
  });
});
