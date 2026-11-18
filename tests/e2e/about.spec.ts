import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// About: why the show is called "Jester's Privilege", the three Jesters' portraits and bios, belief, church,
// and how to listen.
const PAGE = "/about";

test.describe("About", () => {
  test("is reached from the home page's Meet the Jesters", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "More about the Jesters" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "About" })
    ).toBeVisible();
  });

  test("every Jester's headshot loads from the build", async ({ page }) => {
    await page.goto(PAGE);
    const jesters = page.getByRole("region", { name: "The Jesters" });
    for (const name of ["Michael Belmear", "Dan Collins", "Aaron Canen"]) {
      const photo = jesters.getByRole("img", { name: new RegExp(`^${name}`) });
      await photo.scrollIntoViewIfNeeded();
      await expect
        .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    }
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
