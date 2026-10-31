import { expect, type Page } from "@playwright/test";

// Helpers for tests that play Episodes in the persistent player.

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

/**
 * Serves every Episode's audio (the Feed's .mp3 addresses) as a minute of
 * silence, in byte ranges as the podcast host does: Chromium seeks only
 * within audio fetched that way, and ignores a seek into a plain response.
 */
export async function serveEpisodeAudio(page: Page) {
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
}

/** The docked player bar, or its offer to resume. */
export const playerBar = (page: Page) =>
  page.getByRole("region", { name: "Player" });

/** Where the audio element is, read from the page. */
export const audioState = (page: Page) =>
  page.locator("audio").evaluate((element: HTMLAudioElement) => ({
    paused: element.paused,
    time: element.currentTime,
  }));

/** Waits until the audio plays and its position moves on. */
export async function expectPlaying(page: Page) {
  const start = (await audioState(page)).time;
  await expect
    .poll(async () => audioState(page), { timeout: 5000 })
    .toMatchObject({ paused: false, time: expect.any(Number) });
  await expect
    .poll(async () => (await audioState(page)).time, { timeout: 5000 })
    .toBeGreaterThan(start);
}

/**
 * Presses an Episode's Play (or Resume) button until the Episode plays. A
 * press before the page has hydrated does nothing, as on a slow phone. Once
 * the Episode plays, the button reads Pause, so no press is ever repeated.
 */
export async function startEpisode(
  page: Page,
  name: string,
  { keyboard = false } = {}
) {
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
      .poll(async () => (await audioState(page)).paused, { timeout: 1000 })
      .toBe(false);
  }).toPass({ timeout: 10000 });
}
