import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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

const transcript = (page: Page) =>
  page.getByRole("region", { name: "Transcript" });

// Words from late in Episode 1's fixture Transcript, past the preview.
const lateWords = "every court needs a Fool";

test.describe("Interactive Transcript", () => {
  test("holds the full Transcript in the page's HTML, opening it on request", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/episodes/1")).text();
    expect(html).toContain(lateWords);

    await page.goto("/episodes/1");
    await expect(transcript(page)).toContainText("machine");
    const late = transcript(page).getByText(lateWords);
    await expect(late).toBeHidden();
    const expand = page.getByRole("button", {
      name: "Read the full transcript",
    });
    // A press before the page has hydrated does nothing, so press until open.
    await expect(async () => {
      if (await expand.count()) await expand.click();
      await expect(late).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
  });

  test("plays the Episode from a timestamp, highlighting what's being said", async ({
    page,
  }) => {
    await page.goto("/episodes/1");
    await startEpisode(page, "Play from 0:20");
    await expect
      .poll(async () => (await audioState(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(20);
    await expectPlaying(page);
    await expect(transcript(page).locator("[aria-current=true]")).toContainText(
      "So the reason"
    );
  });

  test("switches the player over from another Episode", async ({ page }) => {
    await page.goto("/episodes/2");
    await startEpisode(page, "Play Episode 2");
    await expectPlaying(page);
    // A client-side navigation, so Episode 2 keeps playing on arrival.
    await page
      .getByRole("navigation", { name: "More Episodes" })
      .getByRole("link", { name: /^Previous Episode/ })
      .click();
    await expect(page).toHaveURL(/\/episodes\/1$/);
    await page.getByRole("button", { name: "Play from 0:20" }).click();
    await expect(playerBar(page)).toContainText("Celebrity Pastors");
    await expect
      .poll(async () => (await audioState(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(20);
    await expectPlaying(page);
  });

  test("leaves an Episode without a Transcript without the section", async ({
    page,
  }) => {
    // The sibling tests find the section on Episode 1 by the same locator.
    await page.goto("/episodes/bonus/listener-confessions-christmas-edition");
    await expect(
      page.getByRole("heading", { level: 1, name: /Christmas Edition/ })
    ).toBeVisible();
    await expect(transcript(page)).toHaveCount(0);
  });

  test("shows the site's own Transcript of an Episode the feed links none for", async ({
    request,
  }) => {
    // The fixture's Episode 4 has only a Transcript saved on the branch.
    const html = await (await request.get("/episodes/4")).text();
    expect(html).toContain("start with a pun");
  });

  test("shows the Transcript the feed links over the site's own", async ({
    request,
  }) => {
    // The fixture saves a Transcript of Episode 1 too; the feed's wins.
    const html = await (await request.get("/episodes/1")).text();
    expect(html).toContain(lateWords);
    expect(html).not.toContain("This saved Transcript loses");
  });

  test("has no detectable accessibility violations, opened in full", async ({
    page,
  }) => {
    await page.goto("/episodes/1");
    const expand = page.getByRole("button", {
      name: "Read the full transcript",
    });
    await expect(async () => {
      if (await expand.count()) await expand.click();
      await expect(expand).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 10000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
