import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { microcopy } from "../src/content/microcopy";
import { scrollThrough } from "./hero-story";

// The site before Episode 1 is published. These run only against a build
// from the empty feed (`npm run test:e2e:empty-feed`, docs/testing.md);
// that build succeeding is itself the check that every route exports with
// no Episodes.
test.describe("Coming soon", { tag: "@empty-feed" }, () => {
  // The zero-Episodes message, as Michael approved it (2026-11-03).
  for (const path of ["/", "/episodes"]) {
    test(`${path} says the Episodes have wandered off`, async ({ page }) => {
      await page.goto(path);
      const latest = page.getByRole("region", { name: "Latest Episode" });
      await expect(latest).toContainText(
        "Our Episodes have wandered off, which is awkward for a show about a church that wanders. We're out rounding them up. Check back soon."
      );
      await expect(latest.getByRole("link")).toHaveCount(0);
    });
  }

  test("the navigation leaves out Episodes", async ({ page }) => {
    await page.goto("/");
    // At phone width the menu holds the navigation.
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Episodes" })).toHaveCount(0);
  });

  test("the Episode route's placeholder is the 404 page, kept out of search engines", async ({
    page,
  }) => {
    // Built, rather than the host's 404 for an address with no page.
    const response = await page.goto("/episodes/coming-soon");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: microcopy.notFoundTitle.text,
      })
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
  });

  test("the build manifest names no newest Episode", async ({ request }) => {
    const response = await request.get("/build-manifest.json");
    expect(await response.json()).toMatchObject({ newestEpisodeGuid: null });
  });

  for (const path of ["/", "/episodes", "/episodes/coming-soon"]) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    for (const colorScheme of ["light", "dark"] as const) {
      test(`${path} has no detectable accessibility violations (${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        // axe samples colors mid-fade, so let the story's reveal finish first.
        if (path === "/") await scrollThrough(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
});
