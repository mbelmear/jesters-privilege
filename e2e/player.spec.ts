import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  audioState,
  expectPlaying,
  playerBar,
  rememberEpisodeTwo,
  serveEpisodeAudio,
  startEpisode,
} from "./player";

test.beforeEach(async ({ page }) => {
  await serveEpisodeAudio(page);
});

test.describe("Persistent player", () => {
  test("plays the latest Episode from the home page", async ({ page }) => {
    await page.goto("/");
    await startEpisode(page, "Play Episode 4");
    await expect(playerBar(page)).toContainText("Is Humor a Virtue?");
    await expectPlaying(page);
  });

  test("plays an Episode from its page, and keeps playing across pages", async ({
    page,
  }) => {
    await page.goto("/episodes/2");
    await startEpisode(page, "Play Episode 2");
    await expectPlaying(page);

    // A client-side navigation, as a listener browsing while they listen.
    await page
      .getByRole("navigation", { name: "More Episodes" })
      .getByRole("link", { name: /^Next Episode/ })
      .click();
    await expect(page).toHaveURL(/\/episodes\/3$/);
    await expect(playerBar(page)).toContainText("The Holy Fool");
    await expectPlaying(page);
  });

  test("resumes a partly heard Episode where it was left", async ({ page }) => {
    await rememberEpisodeTwo(page);
    await page.goto("/gallery");
    await expect(playerBar(page)).toContainText("The Holy Fool");
    await startEpisode(page, "Resume from 0:30 Episode 2", { keyboard: true });
    await expect
      .poll(async () => (await audioState(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(30);
    await expectPlaying(page);
    // The offer's button goes, and the bar's Pause takes its focus.
    await expect(
      playerBar(page).getByRole("button", { name: "Pause" })
    ).toBeFocused();
  });

  test("closes by keyboard, and resumes from where it was closed", async ({
    page,
  }) => {
    await page.goto("/episodes/2");
    await startEpisode(page, "Play Episode 2");
    await expectPlaying(page);
    await playerBar(page)
      .getByRole("button", { name: "Show player controls" })
      .click();
    await playerBar(page)
      .getByRole("button", { name: "Forward 30 seconds" })
      .click();
    await expect
      .poll(async () => (await audioState(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(30);

    await playerBar(page).getByRole("button", { name: "Close player" }).focus();
    await page.keyboard.press("Enter");
    await expect(playerBar(page)).toBeHidden();
    // Focus goes on to the page's content, not <body>.
    await expect(page.getByRole("main")).toBeFocused();
    await expect
      .poll(async () => (await audioState(page)).paused, { timeout: 1000 })
      .toBe(true);

    // Closed on every page: browsing on doesn't bring it back.
    const episodes = page.getByRole("navigation", { name: "More Episodes" });
    await episodes.getByRole("link", { name: /^Next Episode/ }).click();
    await expect(page).toHaveURL(/\/episodes\/3$/);
    await expect(playerBar(page)).toBeHidden();
    await episodes.getByRole("link", { name: /^Previous Episode/ }).click();
    await expect(page).toHaveURL(/\/episodes\/2$/);

    // Closed past 0:30, so Play offers to carry on from there.
    await startEpisode(page, /^Resume from 0:[3-5]\d Episode 2$/);
    await expect
      .poll(async () => (await audioState(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(30);
    await expectPlaying(page);
  });

  test("works by keyboard, with every control named", async ({ page }) => {
    await page.goto("/episodes/2");
    await startEpisode(page, "Play Episode 2", { keyboard: true });
    await expectPlaying(page);
    await playerBar(page).getByRole("button", { name: "Pause" }).focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await audioState(page)).paused, { timeout: 1000 })
      .toBe(true);

    await playerBar(page)
      .getByRole("button", { name: "Show player controls" })
      .focus();
    await page.keyboard.press("Enter");
    const position = playerBar(page).getByRole("slider", { name: "Position" });
    await expect(position).toBeVisible();
    await position.focus();
    const before = Number(await position.inputValue());
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await position.inputValue()), { timeout: 2000 })
      .toBeGreaterThan(before);

    const results = await new AxeBuilder({ page }).include("#player").analyze();
    expect(results.violations).toEqual([]);
  });

  test("never covers the footer, and fits a phone's width", async ({
    page,
  }) => {
    await page.goto("/episodes/2");
    await startEpisode(page, "Play Episode 2");
    await expect(playerBar(page)).toBeVisible();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const footer = document.querySelector("footer");
            const bar = document.getElementById("player");
            if (!footer || !bar) return null;
            return (
              bar.getBoundingClientRect().top -
              footer.getBoundingClientRect().bottom
            );
          }),
        { timeout: 2000 }
      )
      // WebKit scrolls by whole pixels over a page of fractional height (a
      // Transcript's 29.25px lines), so the bottom can stop short by less
      // than one: rounding, not the bar covering the footer.
      .toBeGreaterThan(-1);

    await playerBar(page)
      .getByRole("button", { name: "Show player controls" })
      .click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
