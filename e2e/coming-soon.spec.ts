import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { reveal, storyParagraphs } from "./hero-story";

// The site before Episode 1 is published. These run only against a build
// from the empty feed (`npm run test:e2e:empty-feed`, docs/testing.md);
// that build succeeding is itself the check that every route exports with
// no Episodes.
test.describe("Coming soon", { tag: "@empty-feed" }, () => {
  test("the home page says Episode 1 is on its way", async ({ page }) => {
    await page.goto("/");
    const latest = page.getByRole("region", { name: "Latest Episode" });
    await expect(latest).toContainText("Episode 1 is on its way.");
    await expect(latest.getByRole("link")).toHaveCount(0);
  });

  test("the navigation leaves out Episodes", async ({ page, isMobile }) => {
    await page.goto("/");
    // On phones the menu holds the navigation.
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
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
        name: "You've wandered from the court",
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

  test("the home page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the home page has no detectable accessibility violations (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      // axe samples colors mid-fade, so let the story's reveal finish first.
      for (const paragraph of await storyParagraphs(page).all()) {
        await reveal(paragraph);
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
