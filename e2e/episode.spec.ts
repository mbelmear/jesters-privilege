import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Every Episode in the fixture feed, oldest first, at its address (ADR 0002).
const episodes = [
  {
    path: "/episodes/bonus/introducing-jesters-privilege-trailer",
    title: "Introducing Jester's Privilege - Trailer",
  },
  { path: "/episodes/1", title: "Celebrity Pastors" },
  { path: "/episodes/2", title: "The Holy Fool" },
  { path: "/episodes/3", title: "Mockery and the Prophets" },
  {
    path: "/episodes/bonus/listener-confessions-christmas-edition",
    title: "Listener Confessions: Christmas Edition",
  },
  { path: "/episodes/4", title: "Is Humor a Virtue?" },
];

const sequence = (page: Page) =>
  page.getByRole("navigation", { name: "More Episodes" });

test.describe("Episode page", () => {
  for (const { path, title } of episodes) {
    test(`is built for "${title}" at ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /^Play/ })).toBeVisible();
    });
  }

  test("shows Show notes with their links intact", async ({ page }) => {
    await page.goto("/episodes/1");
    const notes = page.getByRole("region", { name: "Show notes" });
    await expect(
      notes.getByRole("link", { name: "Follow us on Instagram." })
    ).toHaveAttribute("href", "https://www.instagram.com/jestersprivilege/");
  });

  test("steps through the Episodes with next and previous", async ({
    page,
  }) => {
    await page.goto("/episodes/1");
    await sequence(page)
      .getByRole("link", { name: /^Next Episode/ })
      .click();
    await expect(page).toHaveURL(/\/episodes\/2$/);
    await sequence(page)
      .getByRole("link", { name: /^Previous Episode/ })
      .click();
    await expect(page).toHaveURL(/\/episodes\/1$/);
  });

  test("links only forward from the first Episode and only back from the latest", async ({
    page,
  }) => {
    await page.goto(episodes[0].path);
    await expect(sequence(page).getByRole("link")).toHaveText([
      /^Next Episode/,
    ]);
    await page.goto(episodes[episodes.length - 1].path);
    await expect(sequence(page).getByRole("link")).toHaveText([
      /^Previous Episode/,
    ]);
  });

  test("copies the link where there's no share sheet", async ({ page }) => {
    await page.addInitScript(() => {
      const copied: string[] = [];
      Object.assign(window, { copied });
      Object.defineProperty(navigator, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });
    await page.goto("/episodes/1");
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Link copied/);
    expect(
      await page.evaluate((): unknown => Reflect.get(window, "copied"))
    ).toEqual([new URL("/episodes/1", page.url()).href]);
  });

  test("opens the share sheet where the browser has one", async ({ page }) => {
    await page.addInitScript(() => {
      const shared: ShareData[] = [];
      Object.assign(window, { shared });
      Object.defineProperty(navigator, "share", {
        value: async (data: ShareData) => void shared.push(data),
      });
    });
    await page.goto("/episodes/1");
    await page.getByRole("button", { name: "Share" }).click();
    await expect
      .poll(() => page.evaluate((): unknown => Reflect.get(window, "shared")))
      .toEqual([
        {
          title: "Episode 1: Celebrity Pastors",
          url: new URL("/episodes/1", page.url()).href,
        },
      ]);
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/episodes/3");
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
      await page.goto("/episodes/3");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
