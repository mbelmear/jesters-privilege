import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  audioState,
  expectPlaying,
  playerBar,
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
    // This device heard Episode 2 to 0:30 on an earlier visit.
    await page.addInitScript(() => {
      localStorage.setItem(
        "player",
        JSON.stringify({
          positions: { "https://api.spreaker.com/episode/70000003": 30 },
          finished: [],
          lastPlayed: "https://api.spreaker.com/episode/70000003",
        })
      );
    });
    await page.goto("/episodes/2");
    // The seek lands before the audio's metadata has loaded, which older
    // iOS Safari ignored.
    await startEpisode(page, "Resume from 0:30 Episode 2");
    await expect
      .poll(async () => (await audioState(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(30);
    await expectPlaying(page);
  });

  test("offers to resume from any page on a return visit", async ({ page }) => {
    // This device heard Episode 2 to 0:30 on an earlier visit.
    await page.addInitScript(() => {
      const guid = "https://api.spreaker.com/episode/70000003";
      localStorage.setItem(
        "player",
        JSON.stringify({
          positions: { [guid]: 30 },
          finished: [],
          lastPlayed: {
            type: "full",
            number: 2,
            guid,
            title: "The Holy Fool",
            durationSeconds: 2280,
            audioUrl: "https://example.com/jesters_privilege_2.mp3",
            artworkUrl: "https://example.com/art.jpg",
          },
        })
      );
    });
    await page.goto("/gallery");
    await expect(playerBar(page)).toContainText("The Holy Fool");
    await startEpisode(page, "Resume from 0:30 Episode 2");
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
      .toBeGreaterThanOrEqual(0);

    await playerBar(page)
      .getByRole("button", { name: "Show player controls" })
      .click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
