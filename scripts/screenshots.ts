// Screenshots of a page of the built site in out/, for checking a visual
// change: phone and desktop, light and dark, each the full page after
// scrolling through it (so reveals and lazy images have run), plus the
// phone's first screen, where most visitors land from Instagram.
// It refuses a missing or stale build in out/; run `npm run build` first. Usage:
//   npm run screenshots -- <page path> [folder] [--click <button>]... [--storage <key>=<json>]... [--element <selector>]... [--missing]
// A path the site doesn't have answers with the 404 page, so it fails unless
// --missing says the 404 page is the one to shoot: #123's prompt named
// /fools-gallery for the Gallery, which lives at /gallery.
//   npm run screenshots -- /styleguide/home .screenshots/home
// Each --click presses the button of that name, in order, then shoots the
// screen as it stands (<size>-<scheme>-clicked.png), for a state that shows
// only after interaction: the player once an Episode plays, a sent form.
//   npm run screenshots -- /episodes/2 --click "Play Episode 2" --click "Show player controls"
// Episode audio is served as silence (e2e/player.ts), so Play really plays.
// Each --storage puts a value in localStorage before the page loads, for a
// state that comes from this device's history: an Episode heard to the end
// (its check in the archive), one partly heard (the offer to resume).
//   npm run screenshots -- /episodes --storage 'player={"positions":{},"finished":["https://api.spreaker.com/episode/70000003"],"lastPlayed":null}'
// These shoot the fixture's Episodes. The preview reads the live feed
// (deploy.yml), so its Episodes differ from these, and it plays their real
// audio.
// Each --element also shoots just the part a CSS selector names, cut from the
// full page (<size>-<scheme>-<selector>.png), for a change to the header or
// footer that a full phone page, thousands of pixels tall, shrinks past
// reading. Cut from the full page, a sticky header or player stays put.
//   npm run screenshots -- /episodes/1 --element footer
import { spawn } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { serveEpisodeAudio } from "../e2e/player";
import { buildFreshness, type SourceFile } from "../src/lib/build-freshness";
import { waitForServer } from "../src/lib/wait-for-server";

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
} as const;
const SCHEMES = ["light", "dark"] as const;

// The site's source, which a build turns into out/.
const SOURCE_FOLDERS = ["src", "public"];

// Stops before serving when out/ has no build, or one older than the source:
// serve would answer every page with a 404, or the screenshots would show old
// code. #122's first run blamed the page's address for a missing build.
async function refuseUnbuiltSite(): Promise<void> {
  const built = await stat(join("out", "index.html")).then(
    ({ mtimeMs }) => mtimeMs,
    () => null
  );
  const sources: SourceFile[] = [];
  for (const folder of SOURCE_FOLDERS) {
    for (const entry of await readdir(folder, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      sources.push({ path, modifiedMs: (await stat(path)).mtimeMs });
    }
  }
  const freshness = buildFreshness(built, sources);
  switch (freshness.kind) {
    case "missing":
      throw new Error("out/ has no build: run `npm run build` first");
    case "stale":
      throw new Error(
        `out/ is older than ${freshness.newest}: run \`npm run build\` again`
      );
    case "fresh":
      return;
    default: {
      const unhandled: never = freshness;
      throw new Error(`Unknown build state ${JSON.stringify(unhandled)}`);
    }
  }
}

async function main() {
  const { positional, clicks, storage, elements, missing } = parseArgs(
    process.argv.slice(2)
  );
  const [page, folder = ".screenshots"] = positional;
  if (!page?.startsWith("/")) {
    throw new Error(
      'Usage: npm run screenshots -- <page path such as /about> [folder] [--click "<button name>"]... [--storage <key>=<json>]... [--element <selector>]... [--missing]'
    );
  }
  await refuseUnbuiltSite();
  await mkdir(folder, { recursive: true });
  const port = await freePort();
  // serve itself, not through npx, so killing it stops the server. A port the
  // system just handed out is free; other sessions serve their own builds on
  // fixed ports, and serve would quietly move off a busy one.
  const server = spawn(
    join("node_modules", ".bin", "serve"),
    [
      "out",
      "--listen",
      String(port),
      "--no-port-switching",
      "--no-request-logging",
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  const exited = new Promise<never>((_, reject) => {
    server.on("exit", (code, signal) =>
      reject(
        new Error(`serve stopped (${code ?? signal ?? "?"}) on port ${port}`)
      )
    );
  });
  const browser = await Promise.race([chromium.launch(), exited]).catch(
    (error: unknown) => {
      server.kill();
      throw error;
    }
  );
  try {
    const url = `http://localhost:${port}${page}`;
    await Promise.race([
      waitForServer(url, {
        fetch,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      }),
      exited,
    ]);
    const { status } = await fetch(url);
    if (status === 404 && !missing) {
      throw new Error(
        `${page} answers with the 404 page: check its address in src/content/shell.ts, or pass --missing to shoot the 404 page`
      );
    }
    for (const [size, options] of Object.entries(SIZES)) {
      for (const colorScheme of SCHEMES) {
        const tab = await browser.newPage({ ...options, colorScheme });
        await serveEpisodeAudio(tab);
        await tab.addInitScript((entries) => {
          for (const [key, value] of entries) localStorage.setItem(key, value);
        }, storage);
        await tab.goto(url);
        // Lazily loaded code (Motion, for an on-scroll reveal) arrives
        // before the scroll that should trigger it.
        await tab.waitForLoadState("networkidle");
        if (size === "phone" && colorScheme === "light") {
          // The first screen's own reveal takes most of a second to rise.
          await tab.waitForTimeout(1200);
          await tab.screenshot({
            path: join(folder, "phone-first-screen.png"),
          });
        }
        await scrollThrough(tab);
        const path = join(folder, `${size}-${colorScheme}.png`);
        await tab.screenshot({ path, fullPage: true });
        console.log(path);
        for (const selector of elements) {
          // At the top of the page, as scrollThrough leaves it, the box is
          // where the element sits on the full page.
          const box = await tab.locator(selector).first().boundingBox();
          if (!box)
            throw new Error(`${page} shows nothing matching ${selector}`);
          const part = join(
            folder,
            `${size}-${colorScheme}-${selector.replace(/[^a-z0-9]+/gi, "-")}.png`
          );
          await tab.screenshot({ path: part, fullPage: true, clip: box });
          console.log(part);
        }
        if (clicks.length > 0) {
          for (const name of clicks) {
            await tab.getByRole("button", { name, exact: true }).click();
            // Lazily loaded UI (the player bar) arrives and settles.
            await tab.waitForTimeout(1500);
          }
          const clicked = join(folder, `${size}-${colorScheme}-clicked.png`);
          await tab.screenshot({ path: clicked });
          console.log(clicked);
        }
        await tab.close();
      }
    }
  } finally {
    server.removeAllListeners("exit");
    server.kill();
    await browser.close();
  }
}

// Splits the arguments into positional ones, the --click button names, the
// --storage entries, the --element selectors, and whether --missing was
// passed.
function parseArgs(args: string[]) {
  const positional: string[] = [];
  const clicks: string[] = [];
  const storage: [string, string][] = [];
  const elements: string[] = [];
  let missing = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--missing") {
      missing = true;
      continue;
    }
    if (arg !== "--click" && arg !== "--storage" && arg !== "--element") {
      positional.push(arg);
      continue;
    }
    const value = args[i + 1];
    if (!value) throw new Error(`${arg} needs a value`);
    i += 1;
    if (arg === "--click") {
      clicks.push(value);
      continue;
    }
    if (arg === "--element") {
      elements.push(value);
      continue;
    }
    const split = value.indexOf("=");
    if (split < 1) {
      throw new Error(`--storage needs <key>=<value>, not "${value}"`);
    }
    storage.push([value.slice(0, split), value.slice(split + 1)]);
  }
  return { positional, clicks, storage, elements, missing };
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

// A port nothing is listening on, from the system.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("The system gave no free port"))
      );
    });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
