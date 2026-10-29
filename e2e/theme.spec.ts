import { expect, test, type Page } from "@playwright/test";

// The page background in each theme: parchment and teal-black from the
// palette in src/app/globals.css.
const PARCHMENT = "rgb(247, 241, 227)";
const TEAL_BLACK = "rgb(12, 28, 29)";

const pageBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("Theme", () => {
  test.describe("with the system set to light", () => {
    test.use({ colorScheme: "light" });

    test("starts light", async ({ page }) => {
      await page.goto("/");
      expect(await pageBackground(page)).toBe(PARCHMENT);
    });

    test("the toggle switches to dark and remembers it across pages", async ({
      page,
    }) => {
      await page.goto("/styleguide");
      const toggle = page.getByRole("button", { name: "Dark theme" });
      await expect(toggle).toHaveAttribute("aria-pressed", "false");

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(await pageBackground(page)).toBe(TEAL_BLACK);

      await page.reload();
      expect(await pageBackground(page)).toBe(TEAL_BLACK);
      await expect(toggle).toHaveAttribute("aria-pressed", "true");

      await page.goto("/");
      expect(await pageBackground(page)).toBe(TEAL_BLACK);
    });

    test("a remembered choice is applied before any app code runs, so there's no flash", async ({
      page,
    }) => {
      await page.addInitScript(() => localStorage.setItem("theme", "dark"));
      // With every app script blocked, only the inline script in <head> can
      // set the theme. It runs while the HTML is parsed, before first paint.
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(await pageBackground(page)).toBe(TEAL_BLACK);
    });
  });

  test.describe("with the system set to dark", () => {
    test.use({ colorScheme: "dark" });

    test("follows the system with no remembered choice", async ({ page }) => {
      await page.goto("/");
      expect(await pageBackground(page)).toBe(TEAL_BLACK);
    });

    test("a remembered light choice overrides the system", async ({ page }) => {
      await page.goto("/styleguide");
      const toggle = page.getByRole("button", { name: "Dark theme" });
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await toggle.click();
      await page.reload();
      expect(await pageBackground(page)).toBe(PARCHMENT);
    });
  });
});
