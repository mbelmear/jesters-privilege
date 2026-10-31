import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The Fools' Gallery: eras in turn, the Renaissance opening with a painting
// band, Stańczyk framed beside his story, and the closing section.
const PAGE = "/gallery";

const era = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
// The band zooms without end, so it's scrolled into view by hand: Playwright's
// own scroll waits for it to hold still.
const band = async (page: Page) => {
  const img = era(page, "The Renaissance")
    .getByRole("figure")
    .first()
    .getByRole("img");
  await img.evaluate((el) => el.scrollIntoView());
  return img;
};
const isWide = (page: Page, min: number) =>
  (page.viewportSize()?.width ?? 0) >= min;

test.describe("Fools' Gallery", () => {
  test("walks through the eras to why this show wears the motley", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Fools' Gallery"
    );
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Holy Fools",
      "The Medieval Court",
      "The Renaissance",
      "The Reformation",
      "Why this show wears the motley",
    ]);
  });

  test("Stańczyk's painting loads from the build's image set", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const painting = page
      .getByRole("article", { name: "Stańczyk" })
      .getByRole("img");
    await painting.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        painting.evaluate((img: HTMLImageElement) =>
          img.complete ? img.currentSrc : ""
        )
      )
      .toMatch(/\/images\/paintings\/stanczyk\/\d+\.(avif|webp)$/);
  });

  test("links straight to a Fool", async ({ page }) => {
    await page.goto(`${PAGE}#stanczyk`);
    await expect(
      page.getByRole("heading", { level: 3, name: "Stańczyk" })
    ).toBeInViewport();
  });

  test("phones get the band's portrait crop, wider screens the whole painting", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const img = await band(page);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc))
      .toMatch(
        isWide(page, 768)
          ? /\/the-ambassadors\/\d+\.\w+$/
          : /\/the-ambassadors\/portrait-\d+\.\w+$/
      );
  });

  test("the band slowly zooms on desktops only", async ({ page }) => {
    await page.goto(PAGE);
    const img = await band(page);
    expect(await img.evaluate((el) => el.getAnimations().length)).toBe(
      isWide(page, 1024) ? 1 : 0
    );
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto(PAGE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
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

test.describe("Fools' Gallery with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  // Reduced motion gives every transition 0.01ms (globals.css), so a style
  // change can leave one briefly running; only the zoom's keyframes count.
  test("the band holds still", async ({ page }) => {
    await page.goto(PAGE);
    const img = await band(page);
    expect(
      await img.evaluate(
        (el) =>
          el.getAnimations().filter((a) => a instanceof CSSAnimation).length
      )
    ).toBe(0);
  });
});
