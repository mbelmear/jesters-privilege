import { expect, test, type Locator } from "@playwright/test";

// The fonts are self-hosted subsets: Google's latin subset plus the accented
// letters the content uses, with the rest of each typeface in a second file
// fetched only for a letter the subset lacks (#57, scripts/fonts.ts).
const PAGE = "/styleguide/paintings";

// How wide a letter sets in the element's brand face, the first family of its
// font, with monospace behind it, and in monospace alone: the same width means
// the brand face lacked the letter. (next/font's own fallback is sized to match
// the brand face, so it can't tell them apart.)
const letterWidths = (element: Locator, letter: string) =>
  element.evaluate((el, letter) => {
    const style = getComputedStyle(el);
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("No 2D canvas to measure with");
    const width = (family: string) => {
      context.font = `${style.fontStyle} ${style.fontWeight} 100px ${family}`;
      return context.measureText(letter).width;
    };
    const [brand] = style.fontFamily.split(",");
    return {
      brand: width(`${brand}, monospace`),
      fallback: width("monospace"),
    };
  }, letter);

test.describe("Fonts", () => {
  test("a page naming Fools fetches only the subsets", async ({ page }) => {
    const fonts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fonts.push(request.url());
    });
    await page.goto(PAGE);
    await page.evaluate(() => document.fonts.ready);

    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.filter((url) => /-rest\b/.test(url))).toEqual([]);
  });

  for (const [name, letter] of [
    ["Stańczyk", "ń"],
    ["Velázquez", "á"],
  ]) {
    test(`${name}'s ${letter} sets in the brand face`, async ({ page }) => {
      await page.goto(PAGE);
      await page.evaluate(() => document.fonts.ready);
      const element = page.getByText(name).first();

      const { brand, fallback } = await letterWidths(element, letter);
      expect(Math.abs(brand - fallback)).toBeGreaterThan(1);
    });
  }
});
