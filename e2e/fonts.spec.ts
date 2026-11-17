import { expect, test, type Locator } from "@playwright/test";

// The fonts are self-hosted subsets: Google's latin subset plus the accented
// letters the content uses, with the rest of each typeface in a second file
// fetched only for a letter the subset lacks (#57, scripts/fonts.ts).
const PAGE = "/styleguide/paintings";

// A rest file, as the build names it, such as
// barlow_semi_condensed_600_rest.<hash>.woff2.
const isRest = (url: string) => /_rest\.[^/]*\.woff2$/.test(url);

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
    expect(fonts.filter(isRest)).toEqual([]);
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

  // A letter no content uses yet, as an episode title from the feed might
  // carry: the rest of the typeface, in the same family, sets it.
  test("a letter beyond the subsets fetches the rest of the face", async ({
    page,
  }) => {
    const fonts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fonts.push(request.url());
    });
    await page.goto(PAGE);
    const element = page.getByText("Stańczyk").first();
    await element.evaluate((el) => {
      el.textContent += " Dvořák";
    });

    await expect.poll(() => fonts.filter(isRest)).toHaveLength(1);
    await page.evaluate(() => document.fonts.ready);
    const { brand, fallback } = await letterWidths(element, "ř");
    expect(Math.abs(brand - fallback)).toBeGreaterThan(1);
  });

  // scripts/fonts.ts keeps only part of Source Serif's weight axis (#94). A
  // weight outside it would quietly set at the nearest kept one, or as a
  // synthesized bold, so every body weight these pages set must be one the
  // face carries. The style guide sets 600, the About page the italic.
  for (const path of ["/styleguide", "/about", "/episodes/1"]) {
    test(`${path} sets the body face only at weights it carries`, async ({
      page,
    }) => {
      await page.goto(path);
      const { carried, used } = await page.evaluate(() => {
        const body = "sourceSerif";
        const carried = [...document.fonts]
          .filter((face) => face.family.replace(/"/g, "") === body)
          .map((face) => face.weight.split(" ").map(Number));
        const used = new Set<string>();
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const element = node.parentElement;
          if (!element || !node.textContent?.trim()) continue;
          const style = getComputedStyle(element);
          if (style.display === "none" || element.closest("script, style"))
            continue;
          if (style.fontFamily.split(",")[0].replace(/"/g, "") === body)
            used.add(style.fontWeight);
        }
        return { carried, used: [...used].map(Number) };
      });

      expect(carried.length).toBeGreaterThan(0);
      expect(used.length).toBeGreaterThan(0);
      const uncarried = used.filter(
        (weight) =>
          !carried.some(([min, max = min]) => weight >= min && weight <= max)
      );
      expect(uncarried).toEqual([]);
    });
  }
});
