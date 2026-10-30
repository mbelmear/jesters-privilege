import { expect, type Locator, type Page } from "@playwright/test";

// The jester story under the home page's logo heading, revealed a paragraph
// at a time.
export const storyParagraphs = (page: Page) => page.locator("h1 + div > p");

export const closingLine = (page: Page) =>
  page.getByText("This is Jester's Privilege.", { exact: true });

// Holds a story paragraph in view until it shows. The reveal plays only
// while a paragraph is on screen, and WebKit can drop a scroll made while
// the page is still loading, so the scroll repeats until it does.
export async function reveal(paragraph: Locator) {
  await expect(async () => {
    await paragraph.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(paragraph).toHaveCSS("opacity", "1", { timeout: 1000 });
  }).toPass();
}

// Brings every section into view, so the reveal and lazy images have run.
export async function scrollThrough(page: Page) {
  const story = storyParagraphs(page);
  await expect(story).toHaveCount(4);
  for (const paragraph of await story.all()) await reveal(paragraph);
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 300) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(50);
  }
}

// Waits until Motion has taken over the story, so a test times Motion
// rather than its download: the waiting paragraphs carry the fallback.
export async function motionLoaded(page: Page) {
  await expect(storyParagraphs(page).first()).toBeAttached();
  await expect(page.locator(".animate-story-fallback")).toHaveCount(0);
}

// Scrolls a story paragraph into view and records how far it sits below its
// place, in pixels, on each frame until it has fully faded in.
export function offsetsAsItAppears(paragraph: Locator): Promise<number[]> {
  return paragraph.evaluate(
    (el) =>
      new Promise<number[]>((resolve) => {
        const offsets: number[] = [];
        el.scrollIntoView({ block: "center" });
        const frame = () => {
          const style = getComputedStyle(el);
          offsets.push(new DOMMatrix(style.transform).f);
          if (Number(style.opacity) === 1) resolve(offsets);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      })
  );
}
