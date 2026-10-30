import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  movingOffsets,
  closingLine,
  motionLoaded,
  offsetsAsItAppears,
  reveal,
  scrollThrough,
} from "./hero-story";

// The home page design at the mockup gate (#14): both hero options, each at
// its own address.
const OPTIONS = [
  { name: "Reveal on scroll", path: "/styleguide/home" },
  { name: "Simple", path: "/styleguide/home/simple" },
] as const;

for (const option of OPTIONS) {
  test.describe(`Home preview (${option.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(option.path);
    });

    test("shows every section of the home page", async ({ page }) => {
      await expect(
        page.getByRole("heading", { level: 1, name: "Jester's Privilege" })
      ).toBeVisible();
      for (const name of [
        "Listen on",
        "Latest Episode",
        "The Fools' Gallery",
        "Meet the Jesters",
      ]) {
        await expect(page.getByRole("region", { name })).toBeAttached();
      }
      await expect(
        page.getByRole("region", { name: "Listen on" }).getByRole("link")
      ).toHaveCount(4);
    });

    test("marks its hero option as the current one", async ({ page }) => {
      await expect(
        page.getByRole("link", { name: option.name })
      ).toHaveAttribute("aria-current", "page");
    });

    test("shows Dan's and Aaron's headshots", async ({ page }) => {
      const jesters = page.getByRole("region", { name: "Meet the Jesters" });
      await jesters.evaluate((el) => el.scrollIntoView());
      for (const image of await jesters.getByRole("img").all()) {
        await expect
          .poll(() =>
            image.evaluate((img: HTMLImageElement) =>
              img.complete ? img.naturalWidth : 0
            )
          )
          .toBeGreaterThan(0);
      }
      await expect(jesters.getByRole("img")).toHaveCount(2);
    });

    test("has no horizontal scroll", async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("is kept out of search engines", async ({ page }) => {
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
        // axe samples colors mid-fade, so let the reveal finish first.
        await scrollThrough(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

test.describe("Home preview hero switch", () => {
  test("switches between the two hero options", async ({ page }) => {
    await page.goto("/styleguide/home");
    await page.getByRole("link", { name: "Simple" }).click();
    await expect(page).toHaveURL(/\/styleguide\/home\/simple$/);
    await page.getByRole("link", { name: "Reveal on scroll" }).click();
    await expect(page).toHaveURL(/\/styleguide\/home$/);
  });

  test("the reveal holds back the story until the visitor scrolls to it", async ({
    page,
  }) => {
    await page.goto("/styleguide/home");
    await expect(closingLine(page)).not.toBeInViewport();
    await expect(closingLine(page)).toHaveCSS("opacity", "0");
    await reveal(closingLine(page));
  });

  test("the simple hero shows the whole story at once", async ({ page }) => {
    await page.goto("/styleguide/home/simple");
    await expect(closingLine(page)).toHaveCSS("opacity", "1");
  });
});

// The same check as the home page's (home.spec.ts), whose motion-on case
// shows it finding the story rising.
test.describe("Home preview with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the revealed story fades in without moving", async ({ page }) => {
    await page.goto("/styleguide/home");
    await motionLoaded(page);
    const offsets = await offsetsAsItAppears(closingLine(page));
    expect(movingOffsets(offsets)).toEqual([]);
    expect(offsets.at(-1)).toBeCloseTo(0);
  });
});
