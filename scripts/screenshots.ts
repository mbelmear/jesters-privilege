// Screenshots of a page of the built site in out/, for checking a visual
// change: phone and desktop, light and dark, each the full page after
// scrolling through it (so reveals and lazy images have run), plus the
// phone's first screen, where most visitors land from Instagram.
// Build first. Usage: npm run screenshots -- <page path> [folder]
//   npm run screenshots -- /styleguide/home .screenshots/home
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
} as const;
const SCHEMES = ["light", "dark"] as const;

async function main() {
  const [page, folder = ".screenshots"] = process.argv.slice(2);
  if (!page?.startsWith("/")) {
    throw new Error(
      "Usage: npm run screenshots -- <page path such as /about> [folder]"
    );
  }
  await mkdir(folder, { recursive: true });
  const port = 4300 + Math.floor(Math.random() * 600);
  const server = spawn(
    "npx",
    ["serve", "out", "--listen", String(port), "--no-request-logging"],
    { stdio: "ignore" }
  );
  const browser = await chromium.launch();
  try {
    const url = `http://localhost:${port}${page}`;
    await waitForServer(url);
    for (const [size, options] of Object.entries(SIZES)) {
      for (const colorScheme of SCHEMES) {
        const tab = await browser.newPage({ ...options, colorScheme });
        await tab.goto(url);
        if (size === "phone" && colorScheme === "light") {
          await tab.waitForTimeout(1000);
          await tab.screenshot({
            path: join(folder, "phone-first-screen.png"),
          });
        }
        await scrollThrough(tab);
        const path = join(folder, `${size}-${colorScheme}.png`);
        await tab.screenshot({ path, fullPage: true });
        console.log(path);
        await tab.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

// Each step pauses long enough for an on-scroll reveal to start.
async function scrollThrough(tab: Page) {
  const height = await tab.evaluate(() => document.body.scrollHeight);
  for (let top = 0; top <= height; top += 400) {
    await tab.evaluate((y) => window.scrollTo(0, y), top);
    await tab.waitForTimeout(200);
  }
  await tab.evaluate(() => window.scrollTo(0, 0));
  await tab.waitForTimeout(1200);
}

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const ok = await fetch(url).then(
      (response) => response.ok,
      () => false
    );
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `The built site didn't serve ${url}; run npm run build first`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
