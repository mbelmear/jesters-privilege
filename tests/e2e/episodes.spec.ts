import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  expectPlaying,
  playerBar,
  serveEpisodeAudio,
  startEpisode,
} from "./player";

// The Episodes archive, the hymnal index: the latest Episode featured, the
// rest in rows under their years, each playable in place.
const PAGE = "/episodes";

const row = (page: Page, title: string) =>
  page.getByRole("listitem").filter({
    has: page.getByRole("heading", { level: 3, name: title }),
  });

test.describe("Episodes", () => {
  test("is reached from the navigation", async ({ page }) => {
    await page.goto("/");
    // At phone width the menu holds the navigation.
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Episodes" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Episodes" })
    ).toBeVisible();
  });

  // Episode Listen links show only on the home page's latest Episode and on
  // Episode pages; home.spec.ts finds them on the home page's card.
  test("offers no podcast apps on its featured card or rows", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await expect(
      page.getByRole("heading", { level: 3, name: "Is Humor a Virtue?" })
    ).toBeVisible();
    await expect(page.getByRole("list", { name: "or listen on" })).toHaveCount(
      0
    );
  });

  test("plays a row's Episode in place, without leaving the archive", async ({
    page,
  }) => {
    await serveEpisodeAudio(page);
    await page.goto(PAGE);
    await startEpisode(page, "Play Episode 2");
    await expect(playerBar(page)).toContainText("The Holy Fool");
    await expectPlaying(page);
    await expect(page).toHaveURL(/\/episodes$/);
  });

  test("leads from a row to its Episode page", async ({ page }) => {
    await page.goto(PAGE);
    await row(page, "The Holy Fool")
      .getByRole("link", { name: "The Holy Fool" })
      .click();
    await expect(page).toHaveURL(/\/episodes\/2$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "The Holy Fool" })
    ).toBeVisible();
  });

  test("marks an Episode heard to the end on this device", async ({ page }) => {
    // This device heard Episode 2 to the end on an earlier visit.
    await page.addInitScript(() => {
      const guid = "https://api.spreaker.com/episode/70000003";
      localStorage.setItem(
        "player",
        JSON.stringify({ positions: {}, finished: [guid], lastPlayed: null })
      );
    });
    await page.goto(PAGE);
    await expect(row(page, "The Holy Fool")).toContainText("Finished");
    // Episode 3 wasn't heard, so the same check finds no mark there.
    await expect(row(page, "Mockery and the Prophets")).not.toContainText(
      "Finished"
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
