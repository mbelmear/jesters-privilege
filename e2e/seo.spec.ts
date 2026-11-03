import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// What search engines and link previews read from the built site: every page
// in out/, found on disk so a page added later is checked too.

const OUT = join(__dirname, "..", "out");

// Each page's address, from its file: out/about.html is /about.
function builtPages(dir = OUT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return builtPages(path);
    if (!entry.name.endsWith(".html")) return [];
    const address = `/${relative(OUT, path).replace(/\.html$/, "")}`;
    return [address === "/index" ? "/" : address];
  });
}

// The 404 page is served for every unknown address, at none of its own.
const pages = builtPages().filter(
  (path) => !["/404", "/_not-found"].includes(path)
);

// A page search engines may list: one that doesn't say noindex.
const indexable = pages.filter(
  (path) =>
    !/<meta name="robots" content="noindex/.test(
      readFileSync(join(OUT, `${path === "/" ? "/index" : path}.html`), "utf8")
    )
);

// What a page's head says about it; null for a tag it lacks.
async function head(page: Page, path: string) {
  await page.goto(path);
  return page.evaluate(() => {
    const attribute = (selector: string, name: string) =>
      document.head.querySelector(selector)?.getAttribute(name) ?? null;
    return {
      title: document.title,
      description: attribute('meta[name="description"]', "content"),
      canonical: attribute('link[rel="canonical"]', "href"),
      card: attribute('meta[property="og:image"]', "content"),
      feed: attribute(
        'link[rel="alternate"][type="application/rss+xml"]',
        "href"
      ),
    };
  });
}

test("finds the built pages, the style guide among them", () => {
  expect(indexable).toContain("/");
  expect(pages).toContain("/styleguide");
  expect(indexable).not.toContain("/styleguide");
});

test("the sitemap lists every page search engines may index, and nothing else", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => new URL(url).pathname
  );
  expect(listed.toSorted()).toEqual(indexable.toSorted());

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(
    "Sitemap: https://jestersprivilegepodcast.com/sitemap.xml"
  );
});

test("every indexable page has its own title, description, and canonical address", async ({
  page,
}) => {
  const heads = [];
  for (const path of indexable)
    heads.push({ path, ...(await head(page, path)) });

  for (const { path, description, canonical } of heads) {
    expect(description, path).toBeTruthy();
    expect(canonical, path).toBe(
      new URL(path, "https://jestersprivilegepodcast.com").href.replace(
        /\/$/,
        ""
      )
    );
  }
  const unique = (values: unknown[]) => new Set(values).size;
  expect(unique(heads.map((h) => h.title))).toBe(heads.length);
  expect(unique(heads.map((h) => h.description))).toBe(heads.length);
});

test("every page links its feed and a 1200 × 630 PNG link preview; each Episode its own", async ({
  page,
  request,
}) => {
  const cards = new Map<string, string>();
  for (const path of pages) {
    const { card, feed } = await head(page, path);
    expect(feed, path).toMatch(/^https:\/\//);
    expect(card, path).toBeTruthy();
    cards.set(path, new URL(card ?? "").pathname);
  }

  for (const card of new Set(cards.values())) {
    const response = await request.get(card);
    expect(response.ok(), card).toBe(true);
    expect(response.headers()["content-type"], card).toBe("image/png");
    // A PNG's IHDR chunk holds its width and height from byte 16.
    const png = await response.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], card).toEqual([
      1200, 630,
    ]);
  }

  const siteCard = cards.get("/");
  const episodes = pages.filter((path) => path.startsWith("/episodes/"));
  for (const path of episodes) expect(cards.get(path), path).not.toBe(siteCard);
  expect(new Set(episodes.map((path) => cards.get(path))).size).toBe(
    episodes.length
  );
});

test("structured data describes the series on the home page and each Episode on its own", async ({
  page,
}) => {
  const structuredData = async (path: string) => {
    await page.goto(path);
    const scripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    return scripts.map((text): unknown => JSON.parse(text));
  };

  expect(await structuredData("/")).toEqual([
    expect.objectContaining({
      "@context": "https://schema.org",
      "@type": "PodcastSeries",
      url: "https://jestersprivilegepodcast.com/",
    }),
  ]);

  const episodes = pages.filter((path) => path.startsWith("/episodes/"));
  expect(episodes.length).toBeGreaterThan(0);
  for (const path of episodes) {
    expect(await structuredData(path), path).toEqual([
      expect.objectContaining({
        "@type": "PodcastEpisode",
        url: `https://jestersprivilegepodcast.com${path}`,
        partOfSeries: expect.objectContaining({ "@type": "PodcastSeries" }),
      }),
    ]);
  }
});

test.describe("Web Analytics", () => {
  const beacon = (page: Page) =>
    page.locator('script[src*="static.cloudflareinsights.com"]');

  test("counts nothing on a build that isn't production", async ({ page }) => {
    for (const path of ["/", "/about"]) {
      await page.goto(path);
      await expect(beacon(page), path).toHaveCount(0);
    }
  });

  // The check above, finding a beacon where one is.
  test("finds the beacon on a page that has one", async ({ page, request }) => {
    const html = (await (await request.get("/about")).text()).replace(
      "</body>",
      `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"test"}'></script></body>`
    );
    await page.route("https://static.cloudflareinsights.com/**", (route) =>
      route.fulfill({ body: "" })
    );
    await page.setContent(html);
    await expect(beacon(page)).toHaveCount(1);
  });
});
