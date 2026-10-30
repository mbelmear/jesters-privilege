import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// A minute of silence as an 8 kHz, 8-bit mono WAV file, served in place of
// every Episode's audio, so the tests play real audio without the network.
function silence(seconds: number): Buffer {
  const rate = 8000;
  const samples = rate * seconds;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); // format chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28); // bytes per second
  header.writeUInt16LE(1, 32); // bytes per sample
  header.writeUInt16LE(8, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(samples, 40);
  // 8-bit PCM is unsigned, so silence sits at the midpoint.
  return Buffer.concat([header, Buffer.alloc(samples, 0x80)]);
}
const audioFile = silence(60);

// Served in byte ranges, as the podcast host does: Chromium can seek only
// within audio fetched that way.
test.beforeEach(async ({ page }) => {
  await page.route(/\.mp3$/, async (route) => {
    const range = /bytes=(\d+)-(\d*)/.exec(
      (await route.request().headerValue("range")) ?? ""
    );
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : audioFile.length - 1;
    await route.fulfill({
      status: range ? 206 : 200,
      contentType: "audio/wav",
      headers: {
        "accept-ranges": "bytes",
        ...(range && {
          "content-range": `bytes ${start}-${end}/${audioFile.length}`,
        }),
      },
      body: audioFile.subarray(start, end + 1),
    });
  });
});

const player = (page: Page) => page.getByRole("region", { name: "Player" });

// Where the audio element is, read from the page.
const audio = (page: Page) =>
  page.locator("audio").evaluate((element: HTMLAudioElement) => ({
    paused: element.paused,
    time: element.currentTime,
  }));

async function expectPlaying(page: Page) {
  const start = (await audio(page)).time;
  await expect
    .poll(async () => audio(page), { timeout: 5000 })
    .toMatchObject({ paused: false, time: expect.any(Number) });
  await expect
    .poll(async () => (await audio(page)).time, { timeout: 5000 })
    .toBeGreaterThan(start);
}

// Presses an Episode's Play (or Resume) button until the Episode plays. A
// press before the page has hydrated does nothing, as on a slow phone. Once
// the Episode plays, the button reads Pause, so no press is ever repeated.
async function start(page: Page, name: string, { keyboard = false } = {}) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(async () => {
    if (await button.count()) {
      if (keyboard) {
        await button.focus();
        await page.keyboard.press("Enter");
      } else {
        await button.click();
      }
    }
    await expect
      .poll(async () => (await audio(page)).paused, { timeout: 1000 })
      .toBe(false);
  }).toPass({ timeout: 10000 });
}

test.describe("Persistent player", () => {
  test("plays the latest Episode from the home page", async ({ page }) => {
    await page.goto("/");
    await start(page, "Play Episode 4");
    await expect(player(page)).toContainText("Is Humor a Virtue?");
    await expectPlaying(page);
  });

  test("plays an Episode from its page, and keeps playing across pages", async ({
    page,
  }) => {
    await page.goto("/episodes/2");
    await start(page, "Play Episode 2");
    await expectPlaying(page);

    // A client-side navigation, as a listener browsing while they listen.
    await page
      .getByRole("navigation", { name: "More Episodes" })
      .getByRole("link", { name: /^Next Episode/ })
      .click();
    await expect(page).toHaveURL(/\/episodes\/3$/);
    await expect(player(page)).toContainText("The Holy Fool");
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
    await start(page, "Resume from 0:30 Episode 2");
    await expect
      .poll(async () => (await audio(page)).time, { timeout: 5000 })
      .toBeGreaterThanOrEqual(30);
    await expectPlaying(page);
  });

  test("works by keyboard, with every control named", async ({ page }) => {
    await page.goto("/episodes/2");
    await start(page, "Play Episode 2", { keyboard: true });
    await expectPlaying(page);
    await player(page).getByRole("button", { name: "Pause" }).focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await audio(page)).paused, { timeout: 1000 })
      .toBe(true);

    await player(page)
      .getByRole("button", { name: "Show player controls" })
      .focus();
    await page.keyboard.press("Enter");
    const position = player(page).getByRole("slider", { name: "Position" });
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
    await start(page, "Play Episode 2");
    await expect(player(page)).toBeVisible();
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

    await player(page)
      .getByRole("button", { name: "Show player controls" })
      .click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
