import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  closingLine,
  motionLoaded,
  offsetsAsItAppears,
  reveal,
  scrollThrough,
} from "./hero-story";

// A transform animated to none computes as the identity matrix.
const UNMOVED = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/;

test.describe("Home", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows a top-level heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Jester's Privilege" })
    ).toBeVisible();
  });

  test("shows every section of the home page", async ({ page }) => {
    for (const name of [
      "Latest Episode",
      "The Fools' Gallery",
      "Meet the Jesters",
    ]) {
      await expect(page.getByRole("region", { name })).toBeAttached();
    }
  });

  // The coming-soon build's absence check (coming-soon.spec.ts) finds it here.
  test("lists Episodes in the navigation", async ({ page, isMobile }) => {
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Episodes" })).toBeVisible();
  });

  test("leads from the latest Episode to its page", async ({ page }) => {
    const latest = page.getByRole("region", { name: "Latest Episode" });
    await latest.getByRole("link", { name: /^Play/ }).click();
    await expect(page).toHaveURL(/\/episodes\/\d+$/);
  });

  test("holds back the story until the visitor scrolls to it", async ({
    page,
  }) => {
    await expect(closingLine(page)).not.toBeInViewport();
    await expect(closingLine(page)).toHaveCSS("opacity", "0");
    await reveal(closingLine(page));
  });

  test("has no horizontal scroll", async ({ page }) => {
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
      // axe samples colors mid-fade, so let the reveal finish first.
      await scrollThrough(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

// Between lowered (24 px) and in place, the story passes through every
// offset as it rises; with reduced motion it only jumps from one to the
// other while it fades.
const between = (offsets: number[]) =>
  offsets.filter((offset) => offset > 0.5 && offset < 23.5);

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test.describe(`Home with reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    // With motion on, the same check finds the story moving.
    test(
      reducedMotion === "reduce"
        ? "the story fades in without moving"
        : "the story rises as it fades in",
      async ({ page }) => {
        await page.goto("/");
        await motionLoaded(page);
        const offsets = await offsetsAsItAppears(closingLine(page));
        if (reducedMotion === "reduce") expect(between(offsets)).toEqual([]);
        else expect(between(offsets).length).toBeGreaterThan(0);
        expect(offsets.at(-1)).toBeCloseTo(0);
      }
    );
  });
}

// The story renders hidden until Motion reveals it, so without Motion it
// must show anyway.
test.describe("Home without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shows the whole story", async ({ page }) => {
    await page.goto("/");
    await expect(closingLine(page)).toHaveCSS("opacity", "1");
    await expect(closingLine(page)).toHaveCSS("transform", UNMOVED);
  });
});

test.describe("Home when its scripts fail to load", () => {
  test("shows the whole story", async ({ page }) => {
    // Scripts only: the stylesheet sits beside them and must still load.
    await page.route(/\/_next\/static\/chunks\/.*\.js/, (route) =>
      route.abort()
    );
    await page.goto("/");
    await expect(closingLine(page)).toHaveCSS("opacity", "1", {
      timeout: 10_000,
    });
    await expect(closingLine(page)).toHaveCSS("transform", UNMOVED);
  });
});
