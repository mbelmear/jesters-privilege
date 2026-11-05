import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { indexable } from "./built-pages";
import { scrollDown, scrollThrough } from "./hero-story";
import {
  expectPlaying,
  playerBar,
  serveEpisodeAudio,
  startEpisode,
} from "./player";

// The hardening sweep (#29): every page a visitor can reach, found on disk, so
// a page or Episode address added later is swept too. Each page's own spec
// covers what's particular to it; this holds what must be true everywhere.
const everyPage = [...indexable, "/no-such-page"];

// The narrowest phones still in use; the phone projects are wider.
const NARROWEST_PHONE = { width: 320, height: 568 };

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// Brings everything that waits to be seen into view.
async function seeAll(page: Page, path: string) {
  if (path === "/") await scrollThrough(page);
  else await scrollDown(page);
}

// Animations that never finish and are running now: the painting bands' zoom
// is one. Keyframe ones only, as docs/testing.md explains.
const endlessAnimations = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation instanceof CSSAnimation &&
            animation.playState === "running" &&
            animation.effect?.getComputedTiming().iterations === Infinity
        ).length
  );

const scan = async (page: Page) => {
  // Turnstile's widget is Cloudflare's frame, not ours to fix.
  const results = await new AxeBuilder({ page })
    .exclude("[data-turnstile]")
    .analyze();
  expect(results.violations).toEqual([]);
};

test.describe("Every page", () => {
  test("the sweep finds the Episode pages, Bonus and Trailer among them", () => {
    expect(everyPage).toContain("/episodes/1");
    expect(everyPage.filter((path) => /bonus/.test(path))).not.toEqual([]);
  });

  for (const path of everyPage) {
    test.describe(path, () => {
      test.use({ reducedMotion: "reduce" });

      for (const colorScheme of ["light", "dark"] as const) {
        test(`passes an accessibility scan in ${colorScheme} with reduced motion`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme });
          await page.goto(path);
          await seeAll(page, path);
          await scan(page);
        });
      }

      test("keeps still with reduced motion", async ({ page }) => {
        await page.goto(path);
        await seeAll(page, path);
        expect(await endlessAnimations(page)).toBe(0);
      });

      test("fits the narrowest phone", async ({ page }) => {
        await page.setViewportSize(NARROWEST_PHONE);
        await page.goto(path);
        await seeAll(page, path);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    });
  }

  // With motion on, the same check finds the Gallery's bands zooming; they
  // zoom only on a wide screen.
  test("the endless-animation check finds the Gallery's zoom with motion on", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/gallery");
    await scrollDown(page);
    await expect.poll(() => endlessAnimations(page)).toBeGreaterThan(0);
  });
});

test.describe("Every button", () => {
  // Hover changes a fill's color, and axe sees only the state a page is in.
  for (const colorScheme of ["light", "dark"] as const) {
    test(`keeps its contrast while hovered (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/styleguide");
      const buttons = page.locator(
        '[data-slot="button"]:visible:not(:disabled)'
      );
      expect(await buttons.count()).toBeGreaterThan(0);
      for (const button of await buttons.all()) {
        await button.hover();
        // Let the color's transition land before axe samples it.
        await button.evaluate((el) =>
          Promise.all(el.getAnimations().map((a) => a.finished))
        );
        await button.evaluate((el) => el.setAttribute("data-hovered", ""));
        const results = await new AxeBuilder({ page })
          .include("[data-hovered]")
          .withRules(["color-contrast"])
          .analyze();
        expect(results.violations).toEqual([]);
        await button.evaluate((el) => el.removeAttribute("data-hovered"));
      }
    });
  }
});

test.describe("The player, in each of its states", () => {
  test.beforeEach(async ({ page }) => {
    await serveEpisodeAudio(page);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(colorScheme, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize(NARROWEST_PHONE);
      });

      test("playing, with its controls open", async ({ page }) => {
        await page.goto("/episodes/2");
        await startEpisode(page, "Play Episode 2");
        await expectPlaying(page);
        await playerBar(page)
          .getByRole("button", { name: "Show player controls" })
          .click();
        await expect(
          playerBar(page).getByRole("slider", { name: "Position" })
        ).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await scan(page);
      });

      test("failed", async ({ page }) => {
        await page.unroute(/\.mp3$/);
        await page.route(/\.mp3$/, (route) => route.abort());
        await page.goto("/episodes/2");
        const play = page.getByRole("button", {
          name: "Play Episode 2",
          exact: true,
        });
        const alert = playerBar(page).getByRole("alert");
        // A press before the page has hydrated does nothing.
        await expect(async () => {
          if (await play.count()) await play.click();
          await expect(alert).toBeVisible({ timeout: 1000 });
        }).toPass();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await scan(page);
      });
    });
  }
});
