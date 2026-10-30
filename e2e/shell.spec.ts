import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Axe samples colors as rendered, so let an opening animation finish first.
const settled = (locator: Locator) =>
  locator.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );

const header = (page: Page) => page.getByRole("banner");

test.describe("Header", () => {
  test("is transparent at the top and solid once the page scrolls", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    const background = () =>
      header(page).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await background()).toBe("rgba(0, 0, 0, 0)");

    const height = () =>
      header(page).evaluate((el) => el.getBoundingClientRect().height);
    const fullHeight = await height();

    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header(page)).toHaveAttribute("data-scrolled", "true");
    await expect.poll(background).not.toBe("rgba(0, 0, 0, 0)");
    // Compact once scrolled.
    await expect.poll(height).toBeLessThan(fullHeight);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header(page)).not.toHaveAttribute("data-scrolled");
  });

  test("never covers the start of the page", async ({ page }) => {
    for (const path of ["/", "/styleguide", "/no-such-page"]) {
      await page.goto(path);
      const headerBottom = await header(page).evaluate(
        (el) => el.getBoundingClientRect().bottom
      );
      const headingTop = await page
        .getByRole("heading", { level: 1 })
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(headingTop, path).toBeGreaterThanOrEqual(headerBottom);
    }
  });

  test("the skip link moves focus past the header to the content", async ({
    page,
    browserName,
  }) => {
    // WebKit only tabs to links with the "press Tab to highlight each item"
    // setting, which Playwright can't turn on.
    test.skip(browserName === "webkit", "WebKit doesn't tab to links");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await skip.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });
});

test.describe("Mobile menu", () => {
  // Below Tailwind's md breakpoint, where the header's links give way to the
  // menu. By width, not isMobile, which Firefox's phone project lacks.
  test.beforeEach(({ viewport }) => {
    test.skip(
      (viewport?.width ?? 0) >= 768,
      "The menu replaces the header links on phones"
    );
  });

  test("opens and closes from the keyboard, keeping focus inside", async ({
    page,
  }) => {
    await page.goto("/");
    const open = page.getByRole("button", { name: "Open menu" });
    await open.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await settled(menu);
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("Tab");
      expect(
        await menu.evaluate((el) => el.contains(document.activeElement))
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("passes an accessibility scan while open", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await settled(menu);
    const results = await new AxeBuilder({ page })
      .include("[role=dialog]")
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("closes once a section is chosen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("link", { name: "About" }).click();
    await expect(menu).toBeHidden();
  });

  test("slides in with Motion", async ({ page }) => {
    await page.goto("/");
    const open = page.getByRole("button", { name: "Open menu" });
    const menu = page.getByRole("dialog", { name: "Menu" });
    // The first open loads the panel and Motion; time the second.
    await open.click();
    await settled(menu);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    // How far the panel sits from its resting place, frame by frame.
    const offsets = await page.evaluate(async () => {
      document
        .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
        ?.click();
      const seen: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 600) {
        await new Promise(requestAnimationFrame);
        const panel = document.querySelector('[role="dialog"]');
        if (panel)
          seen.push(new DOMMatrix(getComputedStyle(panel).transform).m41);
      }
      return seen;
    });
    expect(Math.max(...offsets)).toBeGreaterThan(0);
    expect(offsets.at(-1)).toBe(0);
  });

  test("slides with Motion, and appears at once under reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const open = page.getByRole("button", { name: "Open menu" });
    const menu = page.getByRole("dialog", { name: "Menu" });
    // The first open loads the panel and Motion; check the second.
    await open.click();
    await settled(menu);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await open.click();
    await expect(menu).toBeVisible();
    // Reduced, Motion skips the slide, so the panel is in place two rendered
    // frames on. Count frames, not milliseconds: CI's WebKit sometimes renders
    // none for most of a second (#60). A stall that long would also let the
    // 200 ms slide finish, so on such a run this can't catch a slide.
    const transform = await menu.evaluate(async (el) => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return getComputedStyle(el).transform;
    });
    expect(transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });
});

test.describe("Footer", () => {
  test("gives the contact email", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("link", { name: "hello@jestersprivilegepodcast.com" })
    ).toHaveAttribute("href", "mailto:hello@jestersprivilegepodcast.com");
  });
});

test.describe("Not found", () => {
  test("an unknown address gets the themed 404 with a way home", async ({
    page,
  }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(
      "You've wandered from the court | Jester's Privilege"
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "You've wandered from the court",
      })
    ).toBeVisible();
    await page.getByRole("link", { name: "Return to the court" }).click();
    await expect(page).toHaveURL("/");
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/no-such-page");
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
      await page.goto("/no-such-page");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
